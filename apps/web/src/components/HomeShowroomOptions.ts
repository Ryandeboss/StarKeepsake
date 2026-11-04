
export type RoomScene = 'warm' | 'modern' | 'gallery'
export const ROOM_OPTIONS: ReadonlyArray<{id:RoomScene;label:string;symbol:string}> = [
  {id:'warm',label:'Warm living room',symbol:'⌂'},
  {id:'modern',label:'Modern loft',symbol:'▥'},
  {id:'gallery',label:'Gallery wall',symbol:'▦'},
]
export const WOOD_OPTIONS: ReadonlyArray<{
  id:'walnut'|'oak'|'ebony';label:string
}> = [
  {id:'walnut',label:'Warm walnut'},
  {id:'oak',label:'Natural oak'},
  {id:'ebony',label:'Ebony oak'},
]
