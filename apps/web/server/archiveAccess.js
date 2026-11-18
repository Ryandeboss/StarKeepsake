// Vercel-only authentication and path validation. Never import this into Vite clients.
// Owner verification is delegated to the existing Azure Etsy-paid authorization code.
export const DESIGN_RE=/^SK-[0-9A-F]{16}$/;
export const KEY_RE=/^[A-Za-z0-9_-]{43}$/;
export const NUMBER_RE=/^[1-9][0-9]{0,18}$/;
export const STEP_IDS=new Set([
  'verify','frame','print','panel','mount','artwork','drill','pods','leds',
  'harness','carrier','accent','power','firmware','channel','dark','burn',
  'astro','glass','close','photo','pack','ship'
]);
export const headers={'Cache-Control':'private, no-store',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export const asJson=(data,status=200)=>Response.json(data,{status,headers});
export const packetPath=id=>`production/designs/${id}/frozen-v1.zip`;
export const checklistPrefix=(receipt,transaction,id)=>
  `production/checklists/${receipt}/${transaction}/${id}/`;
export class AuthError extends Error{
  constructor(message,status=401){super(message);this.status=status;}
}
function backend(){
  const url=process.env.VITE_API_BASE_URL;
  if(!url || !/^https:\/\//.test(url))throw new AuthError('Manufacturing authorization backend not configured.',503);
  return url.replace(/\/$/,'');
}
async function parseJson(response,unauthorized='Access not authorized.'){
  if(!response.ok){
    if(response.status===401||response.status===403)throw new AuthError(unauthorized,401);
    if(response.status===404)throw new AuthError('Desig¶»§q«^