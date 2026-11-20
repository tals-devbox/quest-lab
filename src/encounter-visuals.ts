/** Presentation-only helpers. They do not advance combat or alter saved state. */
export const ENCOUNTER_APPROACH_MS=1000;
/** Native permanent encounters, scoped to their original scene. */
export function defeatedSceneActor(room:number,id:string,flags:Record<string,boolean>):boolean {
 const actors:Record<number,Record<string,string>>={13:{ogre:'ogreDefeated'},15:{kobold:'koboldDefeated'},89:{troll:'trollDefeated'},93:{minotaur:'minotaurDefeated'}};
 const flag=actors[room]?.[id];return !!flag&&!!flags[flag];
}
export function approachProgress(remaining:number):number {
  return Math.max(0,Math.min(1,1-remaining/ENCOUNTER_APPROACH_MS));
}
export function advanceApproach(remaining:number,delta:number,active:boolean):number {
  if(!active || !Number.isFinite(delta) || delta<=0)return remaining;
  return Math.max(0,remaining-Math.min(delta,100));
}
export function fallenVisual(s:{combat?:unknown;loot?:{id:string;name:string};fallen?:{id:string;name:string}}){
  if(s.combat)return null;
  const body=s.loot||s.fallen;
  return body?{id:body.id,name:body.name,searchable:!!s.loot}:null;
}
