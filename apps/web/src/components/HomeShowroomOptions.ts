/** Customer-supplied Nano Banana / Gemini mockup plates, stored locally.
 * Each green opening was measured in the ORIGINAL image's normalized
 * coordinates, in TL, TR, BR, BL order. Frames and wall shadows stay photographic.
 */
export type RoomScene =
  | 'warm' | 'modern' | 'gallery' | 'angled' | 'detail' | 'portrait'
  | 'studio-walnut' | 'studio-oak' | 'studio-ebony'

export type Finish = 'walnut'|'oak'|'ebony'
export type PlateQuad = readonly [
  readonly [number,number],readonly [number,number],
  readonly [number,number],readonly [number,number],
]
export type ShowroomPlate = {
  path:string; width:number;height:number; quad:PlateQuad
  label:string;category:'interior'|'studio'; finish:Finish
}
export const SHOWROOM_PLATES:Readonly<Record<RoomScene,ShowroomPlate>>={
  warm:{path:'/showroom/room-warm.png',width:1024,height:572,
    quad:[[.363281,.202797],[.633789,.202797],[.633789,.508741],[.363281,.508741]],
    label:'Warm living room',category:'interior',finish:'walnut'},
  gallery:{path:'/showroom/room-gallery-matted.png',width:1024,height:687,
    quad:[[.348633,.243086],[.650391,.243086],[.649414,.554585],[.347656,.553130]],
    label:'Gallery wall',category:'interior',finish:'walnut'},
  modern:{path:'/showroom/room-modern.png',width:1024,height:687,
    quad:[[.349609,.248908],[.647461,.248908],[.647461,.529840],[.349609,.529840]],
    label:'Modern sitting room',category:'interior',finish:'walnut'},
  angled:{path:'/showroom/room-oblique.png',width:1024,height:687,
    quad:[[.365234,.248908],[.646484,.288210],[.647461,.601164],[.366211,.620087]],
    label:'From the doorway',category:'interior',finish:'walnut'},
  detail:{path:'/showroom/frame-closeup-perspective.png',width:1024,height:687,
    quad:[[.396484,.280932],[.699219,.317321],[.699219,.676856],[.396484,.716157]],
    label:'Frame close-up',category:'studio',finish:'walnut'},
  portrait:{path:'/showroom/room-portrait.png',width:1024,height:687,
    quad:[[.399414,.216885],[.602539,.222707],[.602539,.685590],[.398438,.688501]],
    label:'Portrait in a room',category:'interior',finish:'oak'},
  'studio-walnut':{path:'/showroom/studio-walnut.png',width:1024,height:687,
    quad:[[.318359,.305677],[.680664,.304221],[.680664,.694323],[.318359,.694323]],
    label:'Walnut, up close',category:'studio',finish:'walnut'},
  'studio-oak':{path:'/showroom/studio-oak.png',width:1024,height:687,
    quad:[[.314453,.307132],[.682617,.304221],[.682617,.694323],[.315430,.694323]],
    label:'Oak, up close',category:'studio',finish:'oak'},
  'studio-ebony':{path:'/showroom/studio-ebony.jpg',width:2048,height:1373,
    quad:[[.302734,.281865],[.697754,.279680],[.697754,.717407],[.302734,.717407]],
    label:'Ebony, up close',category:'studio',finish:'ebony'},
}
export const ROOM_OPTIONS:ReadonlyArray<{id:RoomScene;label:string;symbol:string}>=[
  {id:'warm',label:'Warm living room',symbol:'⌂'},
  {id:'modern',label:'Modern',symbol:'▥'},
  {id:'gallery',label:'Gallery',symbol:'▦'},
  {id:'angled',label:'Side view',symbol:'↗'},
  {id:'portrait',label:'Portrait',symbol:'▯'},
  {id:'detail',label:'Frame detail',symbol:'◈'},
]
export const WOOD_OPTIONS:ReadonlyArray<{id:Finish;label:string;scene:RoomScene}>=[
  {id:'walnut',label:'Walnut',scene:'studio-walnut'},
  {id:'oak',label:'Natural oak',scene:'studio-oak'},
  {id:'ebony',label:'Ebony',scene:'studio-ebony'},
]
