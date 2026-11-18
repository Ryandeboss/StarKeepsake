import {list,get} from '@vercel/blob';
import {authorizeOwnerJob,packetPath,asJson,failure,headers}
  from '../../server/archiveAccess.js';

async function handler(request){
  if(request.method!=='GET')return asJson({error:'Method not allowed.'},405);
  try{
    const url=new URL(request.url);
    const receipt=url.searchParams.get('receiptId')||'';
    const transaction=url.searchParams.get('transactionId')||'';
    const saved=await authorizeOwnerJob(request,receipt,transaction);
    const name=packetPath(saved.designId);
    const data=await list({prefix:name,limit:8});
    const frozen=data.blobs.find(x=>x.pathname===name);
    if(!frozen)return asJson({archived:false,
      warning:'This order has no server-frozen packet. It may predate the archive rollout.'},404);
    if(url.searchParams.get('download')!=='1')
      return asJson({archived:true,frozenAt:frozen.uploadedAt,bytes:frozen.size,
        designId:saved.designId,access:'owner-only'});
    const actual=await get(name,{access:'private',useCache:false});
    if(actual?.statusCode!==200||!actual.stream)
      return asJson({error:'Frozen archive unavailable.'},503);
    return new Response(actual.stream,{status:200,headers:{
      ...headers,'Content-Type':'application/zip',
      'Content-Disposition':'attachment; filename="'+saved.designId+'-frozen-maker-packet.zip"'
    }});
  }catch(e){return failure(e);}
}


export default {fetch:handler};
