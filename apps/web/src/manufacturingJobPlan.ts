/**
 * Per-saved-design physical production planning, NOT an approved shopping cart.
 * Never derive N from available driver channels or the digital star count.
 * Source of truth: the immutable saved physicalStars subset for this Design ID.
 * Catalog and prototype verification remain explicit holds.
 */
import type {DesignSpec} from './designSpec'
import type {OrderPreferences} from './orderManifest'

export const MAKER_PLAN_VERSION='starkeepsake-candidate-maker-plan-v1'
export type MakerGroup='buy'|'pack'|'bulk'|'make'
export type MakerPart={
  key:string;group:MakerGroup;name:string;quantity:number|null;unit:string;
  rule:string;skuHint:string|null;review:'HOLD'|'SOURCE_AND_VERIFY'|'MEASURE';
  notes:string;required:boolean
}
export type MakerStar={
  ledIndex:number;hipparcosId:number;magnitude:number;
  printXMm:number|null;printYMm:number|null;
  xNormalized:number|null;yNormalized:number|null;
  holeSizeMm:number|null;selectionReason:string;
  pwmValue:null;apertureCategory:null
}
export type MakerStep={id:string;title:string;status:'not_started'}
export type MakerPlan={
  version:typeof MAKER_PLAN_VERSION;designId:string;schemaVersion:string;
  status:'HOLD_FOR_MANUFACTURING_APPROVAL';
  product:{trimWidthMm:number;trimHeightMm:number;orientation:string;frameFinish:string;
    skyLayout:string;inscription:string};
  astronomy:DesignSpec['moment'];catalog:DesignSpec['astronomy'];
  physicalCount:number;configuredMax:number|null;manualSelection:boolean;
  driverCount:number;connectorGroupCount:number;
  geometryValidated:boolean;holds:string[];
  stars:MakerStar[];parts:MakerPart[];steps:MakerStep[]
}
const round=(n:number,dp=3)=>Number(n.toFixed(dp))
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)
const xml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
const clampInt=(n:number)=>Number.isInteger(n)&&n>=0&&n<=128

export const MAKER_STEPS:readonly {id:string;title:string}[]=[
  ['verify','Verify paid receipt, Etsy variation and immutable Design ID'],
  ['frame','Obtain and inspect the correct shadow-box frame'],
  ['print','Order approved print variant from print lab'],
  ['panel','Cut and prepare 3 mm black SINTRA panel'],
  ['mount','Mount the exact customer print without exposed white edges'],
  ['artwork','Inspect print crop, bleed, color, face detail and text'],
  ['drill','Register and transfer approved N-star drill coordinates'],
  ['pods','Fabricate and install N numbered StarPods'],
  ['leds','Fit and label N Lumimax LED3FWAW stars'],
  ['harness','Build star harness and test N numbered channels'],
  ['carrier','Assemble serviceable Pico W + driver carrier'],
  ['accent','Build concealed warm-white accent + diffuser if approved'],
  ['power','Install validated wall power, fuse, entry and protection'],
  ['firmware','Flash design-specific star-channel firmware/config'],
  ['channel','Walk every channel LED 0 through LED N-1'],
  ['dark','Inspect brightness/twinkle and no exposed light dots in dark room'],
  ['burn','Complete approved electrical burn-in protocol'],
  ['astro','Verify star identities, orientation and printed coordinates'],
  ['glass','Clean protective glazing'],
  ['close','Close and secure removable rear cover'],
  ['photo','Record final finished-item inspection photographs'],
  ['pack','Install protection, care insert, cable and shipping packaging'],
  ['ship','Approve as ready to ship only after required holds clear'],
].map(([id,title])=>({id,title}))

export function buildManufacturingJobPlan(design:DesignSpec,prefs:OrderPreferences):MakerPlan{
  const w=design.physicalArtwork?.widthMm,h=design.physicalArtwork?.heightMm
  if(!finite(w)||!finite(h)||w<50||h<50||w>1000||h>1000)
    throw Error('Saved design has invalid manufacturing dimensions.')
  const original=design.physicalStars??[]
  const n=original.length
  const max=design.physicalSelection?.maxPhysicalStars??null
  const spacing=design.physicalSelection?.minSeparationMm??4.5
  const holds:string[]=[]
  if(!n)holds.push('No frozen physicalStars list; do not infer stars from the digital sky.')
  if(n>128)holds.push('Physical-star count exceeds the current planning safety bound.')
  if(n>24)holds.push('LEGACY DEVELOPMENT DESIGN: more than the finalized 24-light product limit. Reconfigure the saved star choices before any manufacturing or drilling.')
  if(max!==null&&n>max)holds.push('Saved physical star count exceeds its configured maximum.')
  if(Math.abs(w-279.4)>.2||Math.abs(h-355.6)>.2)
    holds.push('Saved artboard is not the required 11 × 14-inch trim; revalidate legacy artwork.')
  if(!design.astronomy||!design.moment.location)
    holds.push('Saved astronomy inputs and calculated sky are incomplete.')
  if(design.physicalSelection?.selectedStars!==undefined&&
    design.physicalSelection.selectedStars!==n)
    holds.push('Saved selectedStars count does not match the frozen physicalStars array.')
  const stars:MakerStar[]=original.map(s=>({
    ledIndex:s.ledIndex,hipparcosId:s.hipparcosId,magnitude:s.magnitude,
    printXMm:finite(s.printXMm)?s.printXMm:null,
    printYMm:finite(s.printYMm)?s.printYMm:null,
    xNormalized:finite(s.printXMm)?round(s.printXMm/w,7):null,
    yNormalized:finite(s.printYMm)?round(s.printYMm/h,7):null,
    holeSizeMm:finite(s.holeSizeMm)?s.holeSizeMm:null,
    selectionReason:s.selectionReason,
    pwmValue:null,apertureCategory:null,
  })).sort((a,b)=>a.ledIndex-b.ledIndex)
  const seenIds=new Set<number>()
  let geometryValidated=n>0&&n<=24&&Math.abs(w-279.4)<=.2&&Math.abs(h-355.6)<=.2
  for(let i=0;i<stars.length;i++){
    const s=stars[i]
    const valid=clampInt(s.ledIndex)&&s.ledIndex===i &&
      Number.isInteger(s.hipparcosId)&&s.hipparcosId>0&&
      !seenIds.has(s.hipparcosId)&&finite(s.magnitude)&&
      finite(s.printXMm)&&finite(s.printYMm)&&finite(s.holeSizeMm)&&
      s.holeSizeMm>0&&s.printXMm>2+s.holeSizeMm/2&&
      s.printXMm<w-2-s.holeSizeMm/2&&
      s.printYMm>2+s.holeSizeMm/2&&
      s.printYMm<h-2-s.holeSizeMm/2
    if(!valid)geometryValidated=false
    seenIds.add(s.hipparcosId)
  }
  if(!Number.isFinite(spacing)||spacing<1||spacing>20)geometryValidated=false
  if(geometryValidated){
    for(let i=0;i<stars.length;i++)for(let j=i+1;j<stars.length;j++){
      const a=stars[i],b=stars[j]
      if(Math.hypot(a.printXMm!-b.printXMm!,a.printYMm!-b.printYMm!)<spacing-0.001)
        geometryValidated=false
    }
  }
  if(!geometryValidated)holds.push(
    'Physical LED 0…N-1 indices, unique HIP IDs, trim coordinates, drill clearance or spacing failed validation. No drilling template may be used.')
  // Independently configurable part count: one TLC5947 supports 24 channels.
  const driverCount=Math.ceil(n/24),connectorGroupCount=Math.ceil(n/12)
  if(n>24)holds.push('Multi-board LED driver synchronization, power, space and firmware require a tested prototype.')
  holds.push('Physical printed-star alignment, drill diameter, brightness/PWM and electrical/thermal safety are not yet calibrated.')
  holds.push('Frame variation purchased on Etsy has not been independently compared to its saved finish.')
  holds.push('Supplier parts, landed prices and M3 inventory must be verified; a candidate plan is not an approved order.')
  const parts:MakerPart[]=[]
  const add=(group:MakerGroup,key:string,name:string,quantity:number|null,
    unit:string,rule:string,skuHint:string|null,review:MakerPart['review'],
    notes:string,required=true)=>parts.push({
      group,key,name,quantity,unit,rule,skuHint,review,notes,required
    })
  add('buy','frame','11×14 deep shadow-box frame — '+prefs.finish,1,'frame','one per order',null,
    'SOURCE_AND_VERIFY','Match the Etsy purchased finish and actual rabbet, depth, glazing and hanger.')
  add('buy','professional_print','Professional luster/satin print (exact customer artwork)',1,'print',
    'one print per frame',null,'SOURCE_AND_VERIFY',
    'Send only a lab-accepted exact, ⅛-in or ¼-in bleed file after print-quality review.')
  add('buy','print_pickup','Print shop pickup / delivery expense',1,'expense',
    'actual per-order cost',null,'SOURCE_AND_VERIFY','Record real quote, delivery and travel; no price assumed.')
  add('pack','star_led','Lumimax LED3FWAW star LEDs',n,'LED','N physicalStars','LED3FWAW',
    'SOURCE_AND_VERIFY','Individual LED per frozen physical star; confirm purchase specification and polarity.')
  add('pack','pico','Raspberry Pi Pico W controller',1,'board','1 per frame','PICO-W',
    'SOURCE_AND_VERIFY','One Pico W; use approved firmware and tested service interface.')
  add('pack','led_driver','TLC5947 24-channel LED-driver board(s)',driverCount,'board',
    'ceil(N / 24)','TLC5947','HOLD',
    'Multi-board wiring/thermal/brightness tests required before production.')
  add('pack','accent_mosfet','Accent-light MOSFET driver',1,'module','1 if accent installed',
    null,'HOLD','Provisional while accent subsystem is included; final circuit not approved.')
  add('pack','wall_power','Validated listed wall power supply',1,'adapter','1 per frame',
    null,'HOLD','Rating, listing/certification, cable and power budget require validation.')
  add('pack','power_entry','External power inlet and strain relief',1,'set',
    '1 set per frame',null,'HOLD','Final chassis fit, retention and strain test required.')
  add('pack','fuse','Main fuse/protection assembly',1,'set','1 per frame',
    null,'HOLD','Fuse rating/circuit approval pending.')
  add('pack','distribution','Power distribution board/block',1,'board','1 per frame',
    null,'HOLD','Wiring gauge and terminal ratings unapproved.')
  add('pack','harness_groups','Numbered star harness connector groups',
    connectorGroupCount,'group','ceil(N / 12)',null,'HOLD',
    'Approx. 12 channels per connector; exact connector SKU/pinout pending.')
  add('pack','star_service','Star power service connector pair',1,'pair',
    '1 per harness',null,'HOLD','Connector and serviceability approval pending.')
  add('pack','accent_service','Accent light service connector pair',1,'pair',
    '1 with accent subsystem',null,'HOLD','Only if accent subsystem remains in final recipe.')
  add('pack','mounting_hardware','Electronics carrier standoffs/screws/spacers',null,'set',
    'measured carrier fastener count',null,'MEASURE','Measure against approved serviceable carrier.')
  add('pack','wire_management','Cable clips/tie mounts/wire guides',null,'set',
    'measured routing plan',null,'MEASURE','Route wiring clear of star holes and heat sources.')
  add('pack','rear_closure','Rear-cover fasteners',null,'set',
    'selected rear access panel',null,'MEASURE','Serviceable access closure size not verified.')
  add('pack','hanger_upgrade','Hanging-hardware upgrade if required',null,'set',
    'depends on measured finished weight',null,'MEASURE',
    'Only if the frame-supplied hanger is inadequate.',false)
  add('pack','shipping','Tested protective shipping package and PSU compartment',1,'set',
    '1 per order',null,'HOLD','Carton, corners, inserts, glazing protection and adapter pouch need drop test.')
  add('bulk','sintra','Black 3 mm SINTRA / expanded PVC panel',1,'panel',
    'one '+round(w)+' × '+round(h)+' mm panel',null,'SOURCE_AND_VERIFY',
    'Actual cut/mount fit and drill method must be proven.')
  add('bulk','mount_film','Pressure-sensitive photo mounting film',round(w*h/1000000,4),
    'm²','visible trim area; waste not included',null,'SOURCE_AND_VERIFY',
    'Film spec, adhesion, humidity/flatness and bleed mounting proof pending.')
  add('bulk','petg','Opaque black PETG for StarPods / electronics carrier',null,'g',
    'N='+n+' StarPods + carrier; weigh prototype',null,'MEASURE',
    'No invented grams-per-pod or spool length.')
  add('bulk','star_bus_wire','22–24 AWG stranded common star power bus',null,'m',
    'measured power-bus routing',null,'HOLD','Gauge and voltage drop must be verified.')
  add('bulk','channel_wire','Approximately 26 AWG individual star-channel wire',n,'branches',
    'N numbered channel wires; length to measure',null,'HOLD',
    'Required branch count is exact; total conductor length cannot be inferred yet.')
  add('bulk','main_wire','Main power / accent wiring',null,'m',
    'measured harness length and tested gauge',null,'HOLD','Power capacity and routing unapproved.')
  add('bulk','heat_shrink','Heat-shrink tubing',null,'m',
    'N LED joints + connector/power joints',null,'MEASURE','Measure after approved harness mockup.')
  add('bulk','accent_cob','Warm-white COB accent strip',null,'m',
    'measured hidden channel length',null,'HOLD','Supplier, tested length, diffusion and thermal design pending.')
  add('bulk','accent_channel','Aluminum LED channel and frosted diffuser',null,'m',
    'matched to verified accent strip length',null,'HOLD','No exposed dots; confirm recess and thermal fit.')
  add('bulk','rtv','Electronics-safe neutral-cure black RTV/approved adhesive',null,'ml',
    'N mounting points + cable anchors',null,'HOLD','Compatibility/cure and long-term bond validation pending.')
  add('bulk','instruction_stock','Care/setup insert card stock',1,'sheet',
    'one finished care card per order',null,'SOURCE_AND_VERIFY','Final instructions and warnings need approval.')
  add('bulk','spacer_stock','Frame spacer strips if needed',null,'m',
    'depends on selected frame glazing clearance',null,'MEASURE',
    'Use only when fit requires added gap.',false)
  add('make','starpods','Opaque PETG StarPods',n,'pod',
    'N physical illuminated stars',null,'HOLD','One numbered pod per LED; hole sizes and pods need calibration.')
  add('make','star_harness','One N-channel numbered star wiring harness',1,'assembly',
    'N='+n+' channels; '+connectorGroupCount+' connector groups',null,'HOLD',
    'Pico/driver mapping must match LED 0…N-1.')
  add('make','accent_assembly','Concealed accent-light assembly',1,'assembly',
    'one if accent enabled',null,'HOLD','COB, aluminum diffuser, removable service connector.')
  add('make','carrier','Serviceable Pico/driver/power electronics carrier',1,'assembly',
    'supports '+driverCount+' driver board(s)',null,'HOLD',
    'Power distribution, protection and mechanical clearance unapproved.')
  add('make','rear_cover','Removable rear service cover',1,'cover',
    'one unless frame already provides serviceable cover',null,'MEASURE',
    'May not need fabrication if frame supplied cover is sufficient.',false)
  add('make','care_insert','Printed care and setup insert',1,'insert','one per order',
    null,'SOURCE_AND_VERIFY','Include verified power, operation and support instructions.')
  add('make','drill_template','1:1 front-face star drilling registration draft',1,'file',
    'frozen N-star coordinates',null,'HOLD',
    'Template must be checked against actual print at 100% and panel TOP orientation.')
  return {
    version:MAKER_PLAN_VERSION,designId:design.designId,
    schemaVersion:design.schemaVersion,status:'HOLD_FOR_MANUFACTURING_APPROVAL',
    product:{trimWidthMm:w,trimHeightMm:h,
      orientation:w<h?'portrait':w>h?'landscape':'square',
      frameFinish:prefs.finish,skyLayout:prefs.layout,inscription:prefs.inscription},
    astronomy:design.moment,catalog:design.astronomy,
    physicalCount:n,configuredMax:max,
    manualSelection:design.physicalStarOverrides?.mode==='manual',
    driverCount,connectorGroupCount,geometryValidated,holds,stars,parts,
    steps:MAKER_STEPS.map((s):MakerStep=>({...s,status:'not_started'})),
  }
}
const csv=(items:(string|number|null|boolean)[])=>items.map(value=>{
  const text=String(value??'')
  return '"'+(/^[=+\-@\t\r]/.test(text)?"'"+text:text).replace(/"/g,'""')+'"'
}).join(',')
export function makerPartsCsv(plan:MakerPlan){
  const rows=[['GROUP','CODE','ITEM','REQUIRED','UNIT','FORMULA','CATALOG SKU HINT',
    'VALIDATION','NOTES'].join(',')]
  for(const p of plan.parts)rows.push(csv([p.group,p.key,p.name,
    p.quantity===null?'TO MEASURE':p.quantity,p.unit,p.rule,
    p.skuHint,p.review,p.notes]))
  return rows.join('\n')
}
export function makerStarMapCsv(plan:MakerPlan){
  const rows=[['LED INDEX','HIP ID','MAGNITUDE','PRINT X MM','PRINT Y MM',
    'NORMALIZED X','NORMALIZED Y','HOLE MM','SELECTION','PWM','APERTURE CATEGORY'].join(',')]
  for(const s of plan.stars)rows.push(csv([s.ledIndex,s.hipparcosId,s.magnitude,
    s.printXMm,s.printYMm,s.xNormalized,s.yNormalized,s.holeSizeMm,
    s.selectionReason,'NOT CALIBRATED','NOT CALIBRATED']))
  return rows.join('\n')
}
export function makerChecklistJson(plan:MakerPlan){
  return JSON.stringify({
    designId:plan.designId,version:plan.version,
    warning:'TEMPLATE ONLY. No durable server-side completion/audit is recorded here.',
    status:'NOT_STARTED',steps:plan.steps
  },null,2)
}
/** Exact 1:1 SVG coordinates but NOT calibrated for drilling until physical proof. */
export function makerDrillTemplateSvg(plan:MakerPlan){
  if(!plan.geometryValidated)throw Error('Unsafe or missing frozen star coordinates; drill template held.')
  const {trimWidthMm:w,trimHeightMm:h}=plan.product
  const x0=12,y0=20
  const W=w+24,H=h+44
  const circles=plan.stars.map(s=>
    '<circle cx="'+round(x0+s.printXMm!)+'" cy="'+round(y0+s.printYMm!)+
    '" r="1" fill="none" stroke="#000" stroke-width=".15"/>'+
    '<path d="M '+round(x0+s.printXMm!-.8)+' '+round(y0+s.printYMm!)+
    ' h 1.6 M '+round(x0+s.printXMm!)+' '+round(y0+s.printYMm!-.8)+
    ' v 1.6" stroke="#000" stroke-width=".12"/>'
  ).join('')
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+round(W)+
    'mm" height="'+round(H)+'mm" viewBox="0 0 '+round(W)+' '+round(H)+'">'+
    '<rect width="100%" height="100%" fill="white"/>'+
    '<text x="12" y="7" font-size="4" fill="#000">TOP ↑ FRONT VIEW — '+
    xml(plan.designId)+'</text>'+
    '<text x="12" y="13" font-size="3" fill="#000">DRAFT / NOT AUTHORIZED TO DRILL</text>'+
    '<rect x="'+x0+'" y="'+y0+'" width="'+w+'" height="'+h+
    '" fill="none" stroke="#000" stroke-width=".25"/>'+circles+
    '<path d="M 12 '+round(H-18)+' h 50" stroke="#000" stroke-width=".3"/>'+
    '<text x="12" y="'+round(H-13)+
    '" font-size="3">50 mm verification ruler — PRINT 100% / NEVER FIT TO PAGE</text>'+
    '<text x="12" y="'+round(H-6)+
    '" font-size="3">Match print, TOP, physical hole size and channel list before drilling</text></svg>'
}
