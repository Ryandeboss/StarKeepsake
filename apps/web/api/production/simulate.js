import {get,list,put,del} from '@vercel/blob';
import {DESIGN_RE,KEY_RE,STEP_IDS,PrivateAccessError,
  authorizeOwner,authorizeDesign,authorizedDesignAsset,
  frozenPath,responseJson,errorResponse,privateHeaders}
  from '../../server/archiveAccess.js';

/** Completely isolated from Etsy receipts/jobs, paid-only files and M3 purchasing. */
const PREFIX='production/simulations/orders/';
const STEP_ROOT='production/simulations/checklists/';
const pathFor=id=>PREFIX+id+'.json';
const stepsFor=id=>STEP_ROOT+id+'/';
const stepPath=(id,step)=>stepsFor(id)+'step-'+step+'.json';
const validId=id=>DESIGN_RE.test(id||'');

async function findBlob(path){
  const found=await list({prefix:path,limit:100});
  return found.blobs.find(item=>item.pathname===path)||null;
}
async function parseBlob(path){
  const found=await get(path,{access:'private',useCache:false});
  if(!found||found.statusCode!==200||!found.stream)return null;
  const data=await new Response(found.stream).json();
  return data;
}
async function orderFor(id){
  if(!validId(id))throw new PrivateAccessError('Invalid test Design ID.',400);
  const row=await parseBlob(pathFor(id));
  if(!row||row.designId!==id||!KEY_RE.test(row.accessKey||'')||
     row.status!=='SIMULATED_NOT_PAID')
    throw new PrivateAccessError('Test work order not found.',404);
  return row;
}
const publicOrder=row=>({
  designId:row.designId,createdAt:row.createdAt,
  status:'SIMULATED_NOT_PAID',finish:row.finish,
  layout:row.layout,stars:row.stars,
});
async function listOrders(){
  let cursor,blobs=[],pages=0;
  do{
    const page=await list({prefix:PREFIX,limit:1000,...(cursor?{cursor}:{})});
    blobs.push(...page.blobs.filter(b=>b.pathname.startsWith(PREFIX)&&
      /^SK-[0-9A-F]{16}\.json$/.test(b.pathname.slice(PREFIX.length))));
    cursor=page.hasMore?page.cursor:null;
    pages++;
  }while(cursor&&pages<5);
  if(cursor)throw new PrivateAccessError('Too many test orders; listing incomplete.',503);
  const orders=await Promise.all(blobs.map(async b=>{
    try{return publicOrder(await parseBlob(b.pathname))}
    catch{return null}
  }));
  return orders.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
async function readSteps(id){
  const page=await list({prefix:stepsFor(id),limit:100});
  const values=await Promise.all(page.blobs.filter(blob=>
    blob.pathname.startsWith(stepsFor(id)+'step-')&&
    blob.pathname.endsWith('.json')).map(async blob=>{
    try{
      const step=await parseBlob(blob.pathname);
      return STEP_IDS.has(step?.stepId)&&typeof step.checked==='boolean'?step:null;
    }catch{return null}
  }));
  return Object.fromEntries(values.filter(Boolean).map(x=>[
    x.stepId,{checked:x.checked,updatedAt:x.updatedAt}
  ]));
}
async function handler(request){
  if(!['GET','POST','DELETE'].includes(request.method))
    return responseJson({error:'Method not allowed.'},405);
  try{
    await authorizeOwner(request);
    const params=new URL(request.url).searchParams;
    const id=params.get('designId')||'';
    const view=params.get('view')||'';
    if(request.method==='POST'&&!view){
      if(Number(request.headers.get('content-length')||0)>4096)
        return responseJson({error:'Invalid test request.'},413);
      const body=await request.json();
      if(!validId(body?.designId)||!KEY_RE.test(body?.accessKey||''))
        return responseJson({error:'Saved Design ID and private edit key required.'},400);
      const saved=await authorizeDesign(body.designId,body.accessKey);
      if(!Array.isArray(saved.design?.physicalStars)||
        !saved.design.physicalStars.length||!saved.design.astronomy)
        return responseJson({error:'Finish the star selections before testing.'},409);
      if(!await findBlob(frozenPath(body.designId)))
        return responseJson({error:'Private maker ZIP has not finished archiving.'},409);
      const existing=await parseBlob(pathFor(body.designId));
      if(existing)return responseJson({order:publicOrder(existing),existing:true});
      const record={status:'SIMULATED_NOT_PAID',designId:body.designId,
        accessKey:body.accessKey,createdAt:new Date().toISOString(),
        finish:saved.preferences.finish,layout:saved.preferences.layout,
        stars:saved.design.physicalStars.length};
      await put(pathFor(body.designId),JSON.stringify(record),{
        access:'private',contentType:'application/json',
        addRandomSuffix:false,allowOverwrite:false,
      });
      return responseJson({order:publicOrder(record),existing:false},201);
    }
    if(request.method==='GET'&&!id&&!view){
      return responseJson({orders:await listOrders()});
    }
    if(!validId(id))return responseJson({error:'Saved Design ID required.'},400);
    if(request.method==='DELETE'&&!view){
      await orderFor(id);
      const check=await list({prefix:stepsFor(id),limit:100});
      await del([pathFor(id),...check.blobs.map(b=>b.pathname)]);
      // DO NOT delete the saved design, original photo or real frozen maker ZIP.
      return responseJson({deleted:true,designId:id});
    }
    const record=await orderFor(id);
    if(request.method==='GET'&&view==='design'){
      const saved=await authorizeDesign(id,record.accessKey);
      return responseJson(saved);
    }
    if(request.method==='GET'&&view==='asset'){
      const type=params.get('type')||'';
      const original=await authorizedDesignAsset(id,record.accessKey,type);
      if(!original||!original.body)return responseJson({error:'Private image missing.'},404);
      return new Response(original.body,{status:200,headers:{
        ...privateHeaders,'Content-Type':original.headers.get('content-type')||'image/jpeg'
      }});
    }
    if(request.method==='GET'&&view==='archive'){
      const path=frozenPath(id),blob=await findBlob(path);
      if(!blob)return responseJson({archived:false},404);
      if(params.get('download')!=='1')
        return responseJson({archived:true,designId:id,
          frozenAt:blob.uploadedAt,bytes:blob.size});
      const archived=await get(path,{access:'private',useCache:false});
      if(!archived||archived.statusCode!==200||!archived.stream)
        return responseJson({error:'Private maker archive unavailable.'},503);
      return new Response(archived.stream,{status:200,headers:{
        ...privateHeaders,'Content-Type':'application/zip',
        'Content-Disposition':'attachment; filename="'+id+'-maker-packet.zip"',
      }});
    }
    if(view==='checklist'){
      if(request.method==='GET')
        return responseJson({durable:true,progress:await readSteps(id)});
      if(request.method==='POST'){
        const body=await request.json();
        if(!STEP_IDS.has(body?.stepId)||typeof body.checked!=='boolean')
          return responseJson({error:'Invalid checklist step.'},400);
        const step={designId:id,stepId:body.stepId,checked:body.checked,
          updatedAt:new Date().toISOString()};
        await put(stepPath(id,body.stepId),JSON.stringify(step),{
          access:'private',contentType:'application/json',
          addRandomSuffix:false,allowOverwrite:true,
        });
        return responseJson({durable:true,step});
      }
    }
    return responseJson({error:'Unsupported test order action.'},405);
  }catch(error){return errorResponse(error);}
}
export default {fetch:handler};
