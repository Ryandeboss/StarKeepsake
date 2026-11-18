import {get,list,put} from '@vercel/blob';
import {authorizePaidJob,checklistPrefix,STEP_IDS,
  responseJson,errorResponse} from '../../server/archiveAccess.js';

const stepPath=(prefix,id)=>prefix+'step-'+id+'.json';
async function readProgress(prefix){
  const result=await list({prefix,limit:100});
  const relevant=result.blobs.filter(x=>x.pathname.startsWith(prefix+'step-')&&
    x.pathname.endsWith('.json'));
  const values=await Promise.all(relevant.map(async blob=>{
    const item=await get(blob.pathname,{access:'private',useCache:false});
    if(!item||item.statusCode!==200||!item.stream)return null;
    try{
      const value=await new Response(item.stream).json();
      if(STEP_IDS.has(value.stepId)&&typeof value.checked==='boolean')
        return value;
    }catch{/* Corrupt item cannot mark a step completed. */}
    return null;
  }));
  return Object.fromEntries(values.filter(Boolean).map(x=>[
    x.stepId,{checked:x.checked,updatedAt:x.updatedAt}
  ]));
}
async function handler(request){
  if(!['GET','POST'].includes(request.method))
    return responseJson({error:'Method not allowed.'},405);
  try{
    const url=new URL(request.url);
    const receipt=url.searchParams.get('receiptId')||'';
    const transaction=url.searchParams.get('transactionId')||'';
    const update=request.method==='POST';
    const saved=await authorizePaidJob(request,receipt,transaction,update);
    const prefix=checklistPrefix(receipt,transaction,saved.designId);
    if(!update){
      return responseJson({durable:true,progress:await readProgress(prefix)});
    }
    const body=await request.json();
    if(!STEP_IDS.has(body?.stepId)||typeof body.checked!=='boolean')
      return responseJson({error:'Invalid step or checked state.'},400);
    const record={stepId:body.stepId,checked:body.checked,
      updatedAt:new Date().toISOString(),designId:saved.designId};
    await put(stepPath(prefix,body.stepId),JSON.stringify(record),{
      access:'private',contentType:'application/json',
      addRandomSuffix:false,allowOverwrite:true,
    });
    return responseJson({durable:true,step:record});
  }catch(error){return errorResponse(error);}
}
export default {fetch:handler};
