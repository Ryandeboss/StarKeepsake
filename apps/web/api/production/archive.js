import {list,get} from '@vercel/blob';
import {authorizePaidJob,frozenPath,errorResponse,responseJson,
  privateHeaders} from '../../server/archiveAccess.js';

async function handler(request){
  if(request.method!=='GET')return responseJson({error:'Method not allowed.'},405);
  try{
    const url=new URL(request.url);
    const receipt=url.searchParams.get('receiptId')||'';
    const transaction=url.searchParams.get('transactionId')||'';
    const saved=await authorizePaidJob(request,receipt,transaction);
    const pathname=frozenPath(saved.designId);
    const items=await list({prefix:pathname,limit:5});
    const found=items.blobs.find(b=>b.pathname===pathname);
    if(!found)return responseJson({
      archived:false,warning:'No immutable maker ZIP for this older order.'
    },404);
    if(url.searchParams.get('download')!=='1')
      return responseJson({archived:true,designId:saved.designId,
        frozenAt:found.uploadedAt,bytes:found.size});
    const object=await get(pathname,{access:'private',useCache:false});
    if(!object||object.statusCode!==200||!object.stream)
      return responseJson({error:'Frozen maker ZIP could not be retrieved.'},503);
    return new Response(object.stream,{status:200,headers:{
      ...privateHeaders,'Content-Type':'application/zip',
      'Content-Disposition':'attachment; filename="'+
        saved.designId+'-frozen-maker-packet.zip"'
    }});
  }catch(error){return errorResponse(error);}
}
export default {fetch:handler};
