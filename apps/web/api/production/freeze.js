import {handleUpload} from '@vercel/blob/client';
import {list} from '@vercel/blob';
import {authorizeDesign,frozenPath,DESIGN_RE,KEY_RE,
  PrivateAccessError,errorResponse,responseJson} from '../../server/archiveAccess.js';

async function frozenBlob(id){
  const path=frozenPath(id);
  const result=await list({prefix:path,limit:5});
  return result.blobs.find(blob=>blob.pathname===path)||null;
}
async function handler(request){
  if(request.method==='GET'){
    try{
      const url=new URL(request.url);
      const id=url.searchParams.get('designId')||'';
      await authorizeDesign(id,request.headers.get('x-design-access-key')||'');
      const found=await frozenBlob(id);
      return responseJson({archived:!!found,bytes:found?.size??null,
        frozenAt:found?.uploadedAt??null,storage:'vercel-private-blob'});
    }catch(error){return errorResponse(error);}
  }
  if(request.method!=='POST')return responseJson({error:'Method not allowed.'},405);
  try{
    const body=await request.json();
    const result=await handleUpload({
      request,body,
      onBeforeGenerateToken:async (pathname,clientPayload)=>{
        let claim;
        try{claim=JSON.parse(clientPayload||'{}')}
        catch{throw new PrivateAccessError('Upload claim invalid.',401);}
        if(!DESIGN_RE.test(claim?.designId||'')||
          !KEY_RE.test(claim?.accessKey||'')||
          pathname!==frozenPath(claim.designId))
          throw new PrivateAccessError('Invalid frozen-packet path.',401);
        const saved=await authorizeDesign(claim.designId,claim.accessKey);
        const n=saved.design?.physicalStars?.length;
        if(!Number.isInteger(n)||n<1||n>24||!saved.design.astronomy)
          throw new PrivateAccessError('Design lacks 1–24 finalized physical LEDs.',409);
        if(claim.physicalCount!==n||
          (saved.design.physicalSelection?.selectedStars!==undefined&&
           saved.design.physicalSelection.selectedStars!==n))
          throw new PrivateAccessError(
            'Saved Design ID has a different physical LED count than the maker packet.',409);
        if(await frozenBlob(claim.designId))
          throw new PrivateAccessError('This Design ID already has a frozen ZIP.',409);
        return {
          allowedContentTypes:['application/zip'],
          maximumSizeInBytes:150*1024*1024,
          addRandomSuffix:false,
          allowOverwrite:false,
          validUntil:Date.now()+10*60*1000,
          tokenPayload:JSON.stringify({designId:claim.designId}),
        };
      },
      onUploadCompleted:async ({blob,tokenPayload})=>{
        // Authenticated Blob callback; never expose receipt credentials in URLs.
        const claim=JSON.parse(tokenPayload||'{}');
        if(!DESIGN_RE.test(claim.designId)||
           blob.pathname!==frozenPath(claim.designId))
          throw new Error('Saved design archive callback path mismatch.');
      },
    });
    return responseJson(result);
  }catch(error){return errorResponse(error);}
}
export default {fetch:handler};
