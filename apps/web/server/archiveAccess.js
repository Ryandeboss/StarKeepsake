// Server-only; never import into browser. Azure remains the authority for
// saved-design access and real Etsy paid/matched orders.
export const DESIGN_RE=/^SK-[0-9A-F]{16}$/;
export const KEY_RE=/^[A-Za-z0-9_-]{43}$/;
export const NUMBER_RE=/^[1-9][0-9]{0,18}$/;
export const STEP_IDS=new Set(['verify','frame','print','panel','mount',
  'artwork','drill','pods','leds','harness','carrier','accent','power',
  'firmware','channel','dark','burn','astro','glass','close','photo',
  'pack','ship']);
export const privateHeaders={'Cache-Control':'private, no-store',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export function responseJson(data,status=200){
  return Response.json(data,{status,headers:privateHeaders});
}
export const frozenPath=id=>'production/designs/'+id+'/frozen-v1.zip';
export const checklistPrefix=(receipt,transaction,id)=>
  'production/checklists/'+receipt+'/'+transaction+'/'+id+'/';
export class PrivateAccessError extends Error{
  constructor(message,status=401){super(message);this.status=status;}
}
function backend(){
  const raw=process.env.VITE_API_BASE_URL||'';
  if(!/^https:\/\//.test(raw))throw new PrivateAccessError(
    'Private manufacturing authorization service unavailable.',503);
  return raw.replace(/\/$/,'');
}
async function authorizedJson(res){
  if(!res.ok){
    if([401,403].includes(res.status))throw new PrivateAccessError('Not authorized.',401);
    if(res.status===404)throw new PrivateAccessError('Design or paid Etsy job not found.',404);
    throw new PrivateAccessError('Authorization service unavailable.',503);
  }
  return res.json();
}
/** Reuse Azure's existing owner secret and rate-limited authority.
 * A public customer design key is NEVER enough to simulate an order. */
export async function authorizeOwner(req){
  const key=req.headers.get('x-starkeepsake-admin-key')||'';
  if(key.length<32||key.length>256)
    throw new PrivateAccessError('Owner access key required.',401);
  await authorizedJson(await fetch(backend()+'/api/admin/designs',{
    cache:'no-store',redirect:'error',
    headers:{'X-Starkeepsake-Admin-Key':key},
  }));
  return true;
}
export async function authorizedDesignAsset(id,key,type){
  if(!['original','foreground'].includes(type))
    throw new PrivateAccessError('Unknown private asset.',400);
  if(!DESIGN_RE.test(id)||!KEY_RE.test(key))
    throw new PrivateAccessError('Private design reference invalid.',401);
  const res=await fetch(backend()+'/api/designs/'+id+'/assets/'+type,{
    cache:'no-store',redirect:'error',
    headers:{'X-Design-Access-Key':key},
  });
  if(!res.ok){
    if(res.status===404)return null;
    if([401,403].includes(res.status))
      throw new PrivateAccessError('Private design asset unavailable.',401);
    throw new PrivateAccessError('Private design storage unavailable.',503);
  }
  const mime=res.headers.get('content-type')||'';
  if(!['image/jpeg','image/png','image/webp'].includes(mime.split(';')[0].trim()))
    throw new PrivateAccessError('Unsupported private photo type.',503);
  return res;
}
export async function authorizeDesign(id,key){
  if(!DESIGN_RE.test(id)||!KEY_RE.test(key))
    throw new PrivateAccessError('Invalid saved-design credentials.',401);
  const res=await fetch(backend()+'/api/designs/'+id,{
    cache:'no-store',headers:{'X-Design-Access-Key':key}});
  const design=await authorizedJson(res);
  if(design.designId!==id||!design.design||!design.preferences)
    throw new PrivateAccessError('Saved design does not match.',401);
  return design;
}
export async function authorizePaidJob(req,receipt,transaction,forWrite=false){
  if(!NUMBER_RE.test(receipt)||!NUMBER_RE.test(transaction))
    throw new PrivateAccessError('Invalid Etsy receipt or item identifier.',400);
  const key=req.headers.get('x-starkeepsake-admin-key')||'';
  if(key.length<24||key.length>256)
    throw new PrivateAccessError('Owner key required.',401);
  const url=backend();
  const item=await authorizedJson(await fetch(
    url+'/api/admin/production/jobs/'+receipt+'/'+transaction+'/design',{
      cache:'no-store',headers:{'X-Starkeepsake-Admin-Key':key}}));
  if(!DESIGN_RE.test(item.designId))
    throw new PrivateAccessError('Paid Etsy item not matched to design.',404);
  if(forWrite){
    const payload=await authorizedJson(await fetch(
      url+'/api/admin/production/orders',{
        cache:'no-store',headers:{'X-Starkeepsake-Admin-Key':key}}));
    const job=(payload.jobs||[]).find(row=>
      String(row.receipt_id)===receipt&&
      String(row.transaction_id)===transaction&&
      row.design_id===item.designId);
    if(!job||!['awaiting_review','in_progress'].includes(job.status))
      throw new PrivateAccessError(
        'This order is held, completed or is not eligible for editing.',409);
  }
  return item;
}
export function errorResponse(error){
  const status=error instanceof PrivateAccessError?error.status:503;
  return responseJson({error:error instanceof PrivateAccessError?
    error.message:'Private manufacturing storage unavailable.'},status);
}
