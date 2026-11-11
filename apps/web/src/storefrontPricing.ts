export type FrameFinish='walnut'|'ebony'
export type FrameQuote={id:FrameFinish;label:string;depthInches:number;priceCents:number;
  currency:'USD';mode:'planning'|'catalog';revision:string;updatedAtUtc:string|null}
export const PREVIEW_FRAME_QUOTES:FrameQuote[]=[
  {id:'walnut',label:'Two-tone walnut',depthInches:2.5,priceCents:79900,
    currency:'USD',mode:'planning',revision:'prototype-budget-v1',updatedAtUtc:null},
  {id:'ebony',label:'Matte black',depthInches:3.5,priceCents:89900,
    currency:'USD',mode:'planning',revision:'prototype-budget-v1',updatedAtUtc:null},
]
export const moneyUsd=(cents:number)=>new Intl.NumberFormat('en-US',{
  style:'currency',currency:'USD',maximumFractionDigits:0}).format(cents/100)
export const frameQuoteFor=(quotes:readonly FrameQuote[],finish:string)=>
  quotes.find(q=>q.id===finish)??(finish==='oak'?null:
    PREVIEW_FRAME_QUOTES.find(q=>q.id===finish)??null)
const BASE=(import.meta.env?.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')??''
export async function loadFramePrices():Promise<FrameQuote[]>{
  const response=await fetch(BASE+'/api/storefront/frame-prices',{cache:'no-store'})
  if(!response.ok)throw Error('Price service unavailable')
  const body:unknown=await response.json()
  if(!Array.isArray(body)||body.length!==2)throw Error('Invalid price list')
  const parsed:FrameQuote[]=[]
  for(const item of body){
    if(!item||typeof item!=='object')throw Error('Invalid quote')
    const q=item as Partial<FrameQuote>
    if((q.id!=='walnut'&&q.id!=='ebony')||!Number.isSafeInteger(q.priceCents)||
      q.priceCents===undefined||q.priceCents<100||q.priceCents>2000000||
      q.currency!=='USD'||(q.mode!=='planning'&&q.mode!=='catalog')||
      typeof q.label!=='string'||q.label.length>80||
      typeof q.revision!=='string'||q.revision.length>120||
      typeof q.depthInches!=='number'||q.depthInches<1||q.depthInches>8||
      (q.updatedAtUtc!==null&&typeof q.updatedAtUtc!=='string'))
      throw Error('Invalid quote fields')
    parsed.push(q as FrameQuote)
  }
  if(new Set(parsed.map(q=>q.id)).size!==2)throw Error('Duplicate quote')
  return parsed
}
