import {get,list,put} from '@vercel/blob';
import {authorizePaidJob,responseJson,errorResponse}
  from '../../server/archiveAccess.js';

// A simple owner-only "I have this part" checklist for genuine paid jobs.
// Separated from M3 inventory allocation, payments and the safety/QA checklist.
const keyIsValid=value=>typeof value==='string'&&/^[a-z][a-z0-9_]{1,55}$/.test(value);
const pathFor=(receipt,transaction,id,key)=>
  'production/paid-parts/'+receipt+'/'+transaction+'/'+id+'/part-'+key+'.json';
async function handler(request){
  if(!['GET','POST'].includes(request.method))
    return responseJson({error:'Method not allowed.'},405);
  try{
    const search=new URL(request.url).searchParams;
    const receipt=search.get('receiptId')||'';
    const transaction=search.get('transactionId')||'';
    const update=request.method==='POST';
    const design=await authorizePaidJob(request,receipt,transaction,update);
    if(!update){
      const prefix='production/paid-parts/'+receipt+'/'+transaction+'/'+design.designId+'/';
      const result=await list({prefix,limit:100});
      const records=await Promise.all(result.blobs.map(async entry=>{
        if(!entry.pathname.startsWith(prefix+'part-')||
          !entry.pathname.endsWith('.json'))return null;
        const file=await get(entry.pathname,{access:'private',useCache:false});
        if(!file||file.statusCode!==200||!file.stream)return null;
        try{
          const value=await new Response(file.stream).json();
          return keyIsValid(value.key)&&typeof value.checked==='boolean'?value:null;
        }catch{return null}
      }));
      return responseJson({durable:true,checked:Object.fromEntries(records.filter(Boolean)
        .map(row=>[row.key,row.checked]))});
    }
    if(Number(request.headers.get('content-length')||0)>600)
      return responseJson({error:'Checklist update too large.'},413);
    const body=await request.json();
    if(!keyIsValid(body?.key)||typeof body.checked!=='boolean')
      return responseJson({error:'Invalid part checkbox.'},400);
    const record={key:body.key,checked:body.checked,designId:design.designId,
      updatedAt:new Date().toISOString()};
    await put(pathFor(receipt,transaction,design.designId,body.key),
      JSON.stringify(record),{access:'private',contentType:'application/json',
        addRandomSuffix:false,allowOverwrite:true});
    return responseJson({durable:true,record});
  }catch(error){return errorResponse(error)}
}
export default {fetch:handler};
