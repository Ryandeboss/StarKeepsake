import {get,list,put,del} from '@vercel/blob';
import phases from '../../src/rehearsalPhases.json' with {type:'json'};
import {DESIGN_RE,KEY_RE,STEP_IDS,PrivateAccessError,
  authorizeOwner,authorizeDesign,authorizedDesignAsset,
  frozenPath,responseJson,errorResponse,privateHeaders}
  from '../../server/archiveAccess.js';

/** Owner-only simulation records: no Etsy receipt, charge or fulfillment actions. */
const PREFIX='production/simulations/orders/';
const STEP_ROOT='production/simulations/checklists/';
const WORK_ROOT='production/simulations/work/';
const pathFor=id=>PREFIX+id+'.json';
const stepsFor=id=>STEP_ROOT+id+'/';
const stepPath=(id,step)=>stepsFor(id)+'step-'+step+'.json';
const workPrefix=id=>WORK_ROOT+id+'/';
const workPath=(id,kind,key)=>workPrefix(id)+kind+'-'+key+'.json';
const validId=id=>DESIGN_RE.test(id||'');
const allPhaseSteps=new Set(phases.phases.flatMap(p=>p.steps.map(s=>s.id)));
const printIds=new Set(['exact','bleed_1_8','bleed_1_4']);
const partStatuses=new Set(['needed','in_stock','need_to_buy','ordered','shipped',
  'delivered','inspected','allocated','ready','not_applicable']);
const validationStates=new Set(['research_candidate','datasheet_checked','bench_tested',
  'fit_tested','optical_tested','electrical_tested','thermal_tested','production_approved']);
const evidenceFields=new Set(['frameFit','printProof','firmwarePinMap','powerSupply',
  'supplyCurrent','picoTemperature','driverTemperature','frameTemperature',
  'burnInStart','burnInEnd','burnInDuration','burnInAnomalies','channelWalk',
  'opticalTest','qaNotes','qaInspector','inspectionPhotos','packagingNotes',
  'buildNotes','calibratedPodFit','measuredWireLength','partValidation']);
const savedPartKey=key=>typeof key==='string'&&/^[a-z][a-z0-9_]{1,55}$/.test(key);
const safeText=(x,max=1000)=>typeof x==='string'&&x.length<=max?x:null;
function requireJson(ok,message){if(!ok)throw new PrivateAccessError(message,400);}
async function findBlob(path){
  const found=await list({prefix:path,limit:100});
  return found.blobs.find(item=>item.pathname===path)||null;
}
async function parseBlob(path){
  const found=await get(path,{access:'private',useCache:false});
  if(!found||found.statusCode!==200||!found.stream)return null;
  return await new Response(found.stream).json();
}
async function listUnder(prefix){
  let cursor,blobs=[],pages=0;
  do{
    const page=await list({prefix,limit:1000,...(cursor?{cursor}:{})});
    blobs.push(...page.blobs.filter(blob=>blob.pathname.startsWith(prefix)));
    cursor=page.hasMore?page.cursor:null;
    pages++;
  }while(cursor&&pages<10);
  if(cursor)throw new PrivateAccessError('Test record listing limit exceeded.',503);
  return blobs;
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
  designId:row.designId,createdAt:row.createdAt,status:'SIMULATED_NOT_PAID',
  testOrderId:row.testOrderId||'TEST-'+row.designId,
  finish:row.finish,layout:row.layout,stars:row.stars,
  packetVersion:row.packetVersion||null,
  planVersion:row.planVersion||null,
});
async function listOrders(){
  const blobs=(await listUnder(PREFIX)).filter(b=>
    /^SK-[0-9A-F]{16}\.json$/.test(b.pathname.slice(PREFIX.length)));
  const orders=await Promise.all(blobs.map(async b=>{
    try{const row=await parseBlob(b.pathname);return row?publicOrder(row):null}
    catch{return null}
  }));
  return orders.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
async function readSteps(id){
  const blobs=await listUnder(stepsFor(id));
  const values=await Promise.all(blobs.filter(b=>
    b.pathname.startsWith(stepsFor(id)+'step-')&&b.pathname.endsWith('.json'))
    .map(async blob=>{
      try{
        const step=await parseBlob(blob.pathname);
        return STEP_IDS.has(step?.stepId)&&typeof step.checked==='boolean'?step:null;
      }catch{return null}
    }));
  return Object.fromEntries(values.filter(Boolean).map(x=>[
    x.stepId,{checked:x.checked,updatedAt:x.updatedAt}
  ]));
}
async function readWork(id,row){
  const files=await listUnder(workPrefix(id));
  const parsed=await Promise.all(files.filter(b=>b.pathname.endsWith('.json')).map(async b=>{
    try{return await parseBlob(b.pathname)}catch{return null}
  }));
  const steps={},parts={},evidence={},photos=[];
  let print=null,completion=null;
  for(const entry of parsed){
    if(!entry||entry.designId!==id)continue;
    if(entry.kind==='step'&&allPhaseSteps.has(entry.key))steps[entry.key]=entry;
    if(entry.kind==='part'&&row.parts?.some(p=>p.key===entry.key))parts[entry.key]=entry;
    if(entry.kind==='evidence'&&evidenceFields.has(entry.key))evidence[entry.key]=entry;
    if(entry.kind==='print'&&entry.key==='choice')print=entry;
    if(entry.kind==='completion'&&entry.key==='complete')completion=entry;
    if(entry.kind==='photo'&&typeof entry.photoId==='string'&&
      /^[0-9a-f-]{36}$/.test(entry.photoId))photos.push(entry);
  }
  const total=allPhaseSteps.size;
  const done=Object.values(steps).filter(x=>x.checked===true).length;
  const partsList=row.parts||[];
  // A required physical component cannot be waived with a note. Conditional
  // recipe rows may be marked not applicable after owner review.
  const unready=partsList.filter(p=>p.required&&parts[p.key]?.status!=='ready');
  const unconfirmedNA=partsList.filter(p=>p.required&&parts[p.key]?.status==='not_applicable'&&
    !(parts[p.key]?.notes||'').trim());
  const preflight=phases.phases.slice(0,3).every(phase=>
    phase.steps.every(s=>steps[s.id]?.checked===true));
  const blockers=[];
  if(!(row.stars>=1&&row.stars<=24))blockers.push('Outside the 1–24 physical LED retail limit');
  if(row.geometryValidated!==true)blockers.push('Frozen physical star geometry requires validation');
  if(!print?.approved||!print.supplier)
    blockers.push('Print lab, accepted file variant and proof approval required');
  if(unready.length)blockers.push(unready.length+' required parts are not marked ready');
  if(unconfirmedNA.length)blockers.push('Required parts marked not applicable need written justification');
  if(!preflight)blockers.push('Preflight, files and procurement checks are incomplete');
  const readyToBuild=blockers.length===0;
  const completionBlockers=[...blockers];
  if(done!==total)completionBlockers.push((total-done)+' rehearsal checks remain unchecked');
  if(!photos.length)completionBlockers.push('At least one private final QC photo is required');
  for(const field of ['firmwarePinMap','powerSupply','supplyCurrent','burnInDuration',
    'driverTemperature','frameTemperature','channelWalk','opticalTest','qaNotes']){
    if(!(evidence[field]?.value||'').trim())completionBlockers.push('Missing '+field+' measurement or evidence');
  }
  const complete=completionBlockers.length===0&&Boolean(completion?.completedAt);
  return {durable:true,version:phases.version,
    packetVersion:row.packetVersion||null,planVersion:row.planVersion||null,
    testOrderId:row.testOrderId||'TEST-'+id,steps,parts,evidence,print,photos,
    completedAt:complete?completion.completedAt:null,
    readyToBuild,buildStatus:complete?'TEST_BUILD_COMPLETE':
      readyToBuild?'READY_FOR_TEST_ASSEMBLY':'TEST_HOLD',
    done,total,blockers,completionBlockers};
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
      if(Number(request.headers.get('content-length')||0)>18000)
        return responseJson({error:'Test request is too large.'},413);
      const body=await request.json();
      requireJson(validId(body?.designId)&&KEY_RE.test(body?.accessKey||''),
        'Saved Design ID and private edit key required.');
      const saved=await authorizeDesign(body.designId,body.accessKey);
      const n=saved.design?.physicalStars?.length;
      if(!Number.isInteger(n)||n<1||!saved.design.astronomy)
        return responseJson({error:'Finish the star selections before testing.'},409);
      if(n>24)return responseJson({error:'Retail test orders may have at most 24 physical LEDs. Legacy designs remain on hold.'},409);
      const frozen=await findBlob(frozenPath(body.designId));
      if(!frozen)return responseJson({error:'Private maker ZIP has not finished archiving.'},409);
      const existing=await parseBlob(pathFor(body.designId));
      const plan=body.plan;
      requireJson(plan&&plan.designId===body.designId&&plan.physicalCount===n&&
        typeof plan.version==='string'&&plan.version.length<=100&&
        typeof plan.geometryValidated==='boolean'&&
        Array.isArray(plan.parts)&&plan.parts.length>0&&plan.parts.length<=80&&
        plan.parts.every(p=>savedPartKey(p.key)&&typeof p.required==='boolean'&&
          typeof p.name==='string'&&p.name.length<=130&&
          ['buy','pack','bulk','make'].includes(p.group)&&
          (p.quantity===null||(Number.isFinite(p.quantity)&&p.quantity>=0))&&
          typeof p.unit==='string'&&p.unit.length<=30)&&
        new Set(plan.parts.map(p=>p.key)).size===plan.parts.length,
        'A versioned per-design manufacturing parts snapshot is required.');
      const record={status:'SIMULATED_NOT_PAID',designId:body.designId,
        accessKey:body.accessKey,createdAt:new Date().toISOString(),
        testOrderId:'TEST-'+body.designId.slice(3),
        finish:saved.preferences.finish,layout:saved.preferences.layout,stars:n,
        packetVersion:'frozen-v1',frozenAt:frozen.uploadedAt,
        planVersion:plan.version,geometryValidated:plan.geometryValidated,
        recipeVersion:phases.version,parts:plan.parts.map(p=>({
          key:p.key,name:p.name,group:p.group,quantity:p.quantity,
          unit:p.unit,required:p.required,
        }))};
      // Older test-order records can adopt a frozen recipe snapshot once,
      // without deleting their existing isolated checklist history.
      if(existing){
        if(existing.parts?.length)return responseJson({
          order:publicOrder(existing),existing:true});
        const upgraded={...existing,packetVersion:record.packetVersion,
          frozenAt:record.frozenAt,planVersion:record.planVersion,
          geometryValidated:record.geometryValidated,
          recipeVersion:record.recipeVersion,parts:record.parts};
        await put(pathFor(body.designId),JSON.stringify(upgraded),{
          access:'private',contentType:'application/json',
          addRandomSuffix:false,allowOverwrite:true,
        });
        return responseJson({order:publicOrder(upgraded),existing:true,upgraded:true});
      }
      await put(pathFor(body.designId),JSON.stringify(record),{
        access:'private',contentType:'application/json',
        addRandomSuffix:false,allowOverwrite:false,
      });
      return responseJson({order:publicOrder(record),existing:false},201);
    }
    if(request.method==='GET'&&!id&&!view)return responseJson({orders:await listOrders()});
    if(!validId(id))return responseJson({error:'Saved Design ID required.'},400);
    if(request.method==='DELETE'&&!view){
      await orderFor(id);
      const checks=await listUnder(stepsFor(id));
      const work=await listUnder(workPrefix(id));
      await del([pathFor(id),...checks.map(b=>b.pathname),...work.map(b=>b.pathname)]);
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
      if(params.get('download')!=='1')return responseJson({archived:true,designId:id,
        frozenAt:blob.uploadedAt,bytes:blob.size});
      const archived=await get(path,{access:'private',useCache:false});
      if(!archived||archived.statusCode!==200||!archived.stream)
        return responseJson({error:'Private maker archive unavailable.'},503);
      return new Response(archived.stream,{status:200,headers:{
        ...privateHeaders,'Content-Type':'application/zip',
        'Content-Disposition':'attachment; filename="'+id+'-maker-packet.zip"',
      }});
    }
    if(view==='photo'){
      if(request.method==='POST'){
        if(Number(request.headers.get('content-length')||0)>10*1024*1024)
          return responseJson({error:'Private QC photo upload is too large.'},413);
        const form=await request.formData();
        const file=form.get('photo');
        requireJson(file&&typeof file.arrayBuffer==='function'&&
          file.size>100&&file.size<=8*1024*1024,
          'Select a JPEG, PNG or WebP QC photograph under 8 MB.');
        const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
        const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
        const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
        const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&
          String.fromCharCode(...bytes.slice(8,12))==='WEBP';
        requireJson(jpeg||png||webp,'Unsupported or invalid QC photo bytes.');
        const photoId=crypto.randomUUID();
        const ext=jpeg?'jpg':png?'png':'webp';
        await put(workPrefix(id)+'photo-'+photoId+'.'+ext,file,{
          access:'private',contentType:jpeg?'image/jpeg':png?'image/png':'image/webp',
          addRandomSuffix:false,allowOverwrite:false,
        });
        const record={designId:id,kind:'photo',photoId,
          name:safeText(form.get('label'),100)||'Final inspection photo',
          ext,uploadedAt:new Date().toISOString()};
        await put(workPath(id,'photo-meta',photoId),JSON.stringify(record),{
          access:'private',contentType:'application/json',
          addRandomSuffix:false,allowOverwrite:false,
        });
        return responseJson({uploaded:true,photo:record},201);
      }
      if(request.method==='GET'){
        const photoId=params.get('photoId')||'';
        if(!/^[0-9a-f-]{36}$/.test(photoId))
          return responseJson({error:'Unknown private QC photo ID.'},400);
        const meta=await parseBlob(workPath(id,'photo-meta',photoId));
        if(!meta||meta.designId!==id||!['jpg','png','webp'].includes(meta.ext))
          return responseJson({error:'Private QC photo not found.'},404);
        const object=await get(workPrefix(id)+'photo-'+photoId+'.'+meta.ext,{
          access:'private',useCache:false});
        if(!object||object.statusCode!==200||!object.stream)
          return responseJson({error:'Private QC photo is unavailable.'},404);
        return new Response(object.stream,{status:200,headers:{
          ...privateHeaders,'Content-Type':meta.ext==='jpg'?'image/jpeg':
            meta.ext==='png'?'image/png':'image/webp',
          'Content-Disposition':'attachment; filename="'+id+'-QC-'+photoId+'.'+meta.ext+'"',
        }});
      }
    }
    if(view==='checklist'){
      if(request.method==='GET')return responseJson({durable:true,progress:await readSteps(id)});
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
    if(view==='work'){
      if(request.method==='GET')return responseJson(await readWork(id,record));
      if(request.method==='POST'){
        if(Number(request.headers.get('content-length')||0)>4000)
          return responseJson({error:'Test update too large.'},413);
        const body=await request.json();
        const now=new Date().toISOString();
        if(body?.kind==='complete'){
          const work=await readWork(id,record);
          if(work.completionBlockers.length)
            return responseJson({error:'TEST HOLD: '+work.completionBlockers.join('; ')},409);
          const value={kind:'completion',key:'complete',designId:id,completedAt:now};
          await put(workPath(id,'completion','complete'),JSON.stringify(value),{
            access:'private',contentType:'application/json',
            addRandomSuffix:false,allowOverwrite:true,
          });
          return responseJson({saved:true,value});
        }
        let key,recordValue;
        if(body?.kind==='step'){
          requireJson(allPhaseSteps.has(body.key)&&typeof body.checked==='boolean',
            'Unknown rehearsal checklist step.');
          key=body.key;recordValue={checked:body.checked};
        }else if(body?.kind==='part'){
          requireJson(record.parts?.some(p=>p.key===body.key)&&partStatuses.has(body.status)&&
            validationStates.has(body.validation||'research_candidate')&&
            safeText(body.notes,500)!==null,
            'Invalid order-specific part state.');
          if(body.status==='not_applicable')
            requireJson(Boolean(body.notes.trim()),'Not-applicable parts need an explanation.');
          key=body.key;recordValue={status:body.status,
            validation:body.validation||'research_candidate',notes:body.notes};
        }else if(body?.kind==='print'){
          requireJson(printIds.has(body.variant)&&
            typeof body.approved==='boolean'&&safeText(body.supplier,160)!==null&&
            safeText(body.notes,800)!==null,'Invalid print lab decision.');
          if(body.approved)requireJson(body.supplier.trim().length>=3&&
            body.notes.trim().length>=8,'Record printer acceptance before approving artwork.');
          key='choice';recordValue={variant:body.variant,approved:body.approved,
            supplier:body.supplier,notes:body.notes};
        }else if(body?.kind==='evidence'){
          requireJson(evidenceFields.has(body.key)&&
            safeText(body.value,1000)!==null,'Invalid test measurement or QA evidence.');
          key=body.key;recordValue={value:body.value};
        }else return responseJson({error:'Unsupported test work update.'},400);
        const value={...recordValue,designId:id,kind:body.kind,key,updatedAt:now};
        await put(workPath(id,body.kind,key),JSON.stringify(value),{
          access:'private',contentType:'application/json',
          addRandomSuffix:false,allowOverwrite:true,
        });
        return responseJson({saved:true,value});
      }
    }
    return responseJson({error:'Unsupported test order action.'},405);
  }catch(error){return errorResponse(error);}
}
export default {fetch:handler};
