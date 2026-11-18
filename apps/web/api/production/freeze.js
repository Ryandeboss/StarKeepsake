import {handleUpload} from '@vercel/blob/client';
import {list} from '@vercel/blob';
import {authorizeCustomerDesign,packetPath,DESIGN_RE,KEY_RE,
  AuthError,asJson,failure} from '../../server/archiveAccess.js';

async function findFrozen(id){
  const pathname=packetPath(id);
  const data=await list({prefix:pathname,limit:8});
  return data.blobs.find(x=>x.pathname===pathname)||null;
}
async function handler(request){
  if(request.method==='GET'){
    try{
      const url=new URL(request.url);
      const id=url.searchParams.get('designId')||'';
      await authorizeCustomerDesign(id,request.headers.get('x-design-access-key')||'');
      const archived=await findFrozen(id);
      return asJson({archived:Boolean(archived),frozenAt:archived?.uploadedAt??null,
        bytes:archived?.size??null,source:'vercel-private-blob'});
    }catch(e){return failure(e);}
  }
  if(request.method!=='POST')return asJson({error:'Method not allowed.'},405);
  try{
    const body=await request.json();
    const response=await handleUpload({
      request,body,
      onBeforeGenerateToken:async (pathname,clientPayload)=>{
        let info={};
        try{info=JSON.parse(clientPayload||'{}')}catch{throw new AuthError('Invalid upload context.',401);}
        if(!DESIGN_RE.test(info.designId||'')||
          !KEY_RE.test(info.accessKey||'')||pathname!==packetPath(info.designId))
          throw new AuthError('Invalid immutable packet path.',401);
        const saved=await authorizeCustomerDesign(info¶»§q«^