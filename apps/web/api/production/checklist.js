import {get,list,put} from '@vercel/blob';
import {authorizeOwnerJob,checklistPrefix,STEP_IDS,asJson,failure}
  from '../../server/archiveAccess.js';

function pathFor(prefix,id){return prefix+'step-'+id+'.json';}
async function storedChecks(prefix){
  const data=await list({prefix,limit:100});
  const blobs=data.blobs.filter(b=>b.pathname.startsWith(prefix+'step-')&&
    b.pathname.endsWith('.json'));
  const values=await Promise.all(blobs.map(async blob=>{
    const obj=await get(blob.pathname,{access:'private',useCache:false});
    if(!obj||obj.statusCode!==200||!obj.stream)return null;
    try{
      const record=await new Response(obj.stream).json();
      return STEP_IDS.has(record.stepId)&&typeof record.checked==='boolean'
        ?record:null;
    }catch{return null;}
  }));
  return Object.fromEntries(values.filter(Boolean).map(v=>[v.stepId,
    {checked:v.checked,updatedAt:v.updatedAt}]));
}
async function handler(request){
  if(!['GET','POST'].includes(request.method))
    return asJson({error:'Method not allowed.'},405);
  try{
    const url=new URL(request.url);
    const receipt=url.searchParams.get('receiptId')||'';
    const transaction=url.searchParams.get('transactionId')||'';
    const isUpdate=request.method==='POST';
    const saved=await authorizeOwnerJob(request,receipt,transaction,isUpdate);
    const prefix=checklistPrefix(receipt,transaction,saved.designId);
    if(!isUpdate){
      return asJson({durable:true,source:'vercel-private-blob',progress:
 ¶»§q«^