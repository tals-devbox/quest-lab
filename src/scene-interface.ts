import {availableActions,meets,type Action,type Campaign,type Condition,type GameState} from './rules';
import {topicsFor,type DialogueData,type DialogueTopic} from './dialogue';

export interface SceneRect {left:number;top:number;right:number;bottom:number}
export interface ScenePassage {id:string;to:number;kind:string;entityId?:string;direction?:string;hitRects:SceneRect[];approach?:{x:number;y:number};requires?:Condition;sourceRefs:string[];status?:string;blocked?:string;arrival?:{day?:any;night?:any};controlMask?:{url:string;mask:number;colors?:number[]}}
export interface SceneNavigation {rooms:Record<string,{passages:ScenePassage[];unmappedNativeExits?:number[]}>}
export const scenePassages=(s:GameState,c:Campaign,n:SceneNavigation):ScenePassage[] => (n.rooms[String(s.room)]?.passages||[]).filter(p=>c.rooms.some(r=>r.id===p.to));
export const passageOpen=(s:GameState,p:ScenePassage)=>meets(s,p.requires);
export function passageHit(p:ScenePassage,x:number,y:number,control?:Uint8Array){if(!p.hitRects.some(r=>x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom))return false;if(p.controlMask){if(!control)return false;const color=control[Math.floor(y)*320+Math.floor(x)];return !!((1<<color)&p.controlMask.mask);}return true;}
/** Forgiving input geometry only; original masks, destinations and locks remain authoritative. */
export function passageTouchRects(p:ScenePassage,minWidth=36,minHeight=24):SceneRect[]{return p.hitRects.map(r=>{const w=Math.min(320,Math.max(r.right-r.left,minWidth)),h=Math.min(190,Math.max(r.bottom-r.top,minHeight)),cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2,left=Math.max(0,Math.min(320-w,cx-w/2)),top=Math.max(0,Math.min(190-h,cy-h/2));return{left,right:left+w,top,bottom:top+h}})}
export function closestPassageHit(passages:ScenePassage[],x:number,y:number,controls:(p:ScenePassage)=>Uint8Array|undefined,minWidth=36,minHeight=24):{passage:ScenePassage;x:number;y:number}|undefined{
 const exact=passages.find(p=>passageHit(p,x,y,controls(p)));if(exact)return{passage:exact,x,y};
 const candidates:{passage:ScenePassage;x:number;y:number;distance:number}[]=[];
 for(const p of passages){if(!passageTouchRects(p,minWidth,minHeight).some(r=>x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom))continue;
  // Snap to the nearest original valid pixel, not through another doorway/control region.
  let nearest:{x:number;y:number;distance:number}|undefined;
  for(const r of p.hitRects){const left=Math.max(0,Math.floor(r.left)),right=Math.min(319,Math.ceil(r.right)-1),top=Math.max(0,Math.floor(r.top)),bottom=Math.min(189,Math.ceil(r.bottom)-1);for(let py=top;py<=bottom;py++)for(let px=left;px<=right;px++){if(!passageHit(p,px,py,controls(p)))continue;const distance=(x-px)**2+(y-py)**2;if(!nearest||distance<nearest.distance)nearest={x:px,y:py,distance};}}
  if(nearest)candidates.push({passage:p,...nearest});
 }
 return candidates.sort((a,b)=>a.distance-b.distance||a.passage.id.localeCompare(b.passage.id))[0];
}
export const samePath=(a:readonly string[],b:readonly string[])=>a.length===b.length&&a.every((x,i)=>x===b[i]);
export const pathStarts=(a:readonly string[],b:readonly string[])=>b.every((x,i)=>x===a[i]);
export interface MenuTopic {topic:DialogueTopic;path:string[];order:number;hasChildren:boolean}
export function dialogueBranch(s:GameState,d:DialogueData,id:string,path:readonly string[]=[]):MenuTopic[]{
 const all=topicsFor(s,d,id);const entries=all.flatMap(t=>((t as any).menuEntries||[{path:t.path,when:t.when,status:t.status}]).filter((e:any)=>e.status!=='unsupported'&&meets(s,e.when)).map((e:any)=>({topic:t,path:e.path as string[],order:e.order??10000})));
 return entries.filter(e=>samePath(e.path,path)).filter((e,i,a)=>a.findIndex(x=>x.topic.id===e.topic.id)===i).map(e=>({...e,hasChildren:entries.some(child=>pathStarts(child.path,[...e.path,e.topic.label]))})).sort((a,b)=>a.order-b.order);
}
export function topicHasChildren(s:GameState,d:DialogueData,id:string,t:DialogueTopic,parent:readonly string[]){return dialogueBranch(s,d,id,[...parent,t.label]).length>0;}

const key=(x:string)=>x.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/sdoor$/,'door');
/** Source-named feature aliases where the native adaptation used a different ID.
 * Room qualification prevents a matching name from a departed scene being used.
 */
const aliases:Record<number,Record<string,string[]>>={
 10:{meadow:['flowers'],magicStone:['rock']},
 15:{kobKey:['key']},
 16:{catchingFeat:['seed','spirea'],flyingSeed:['seed'],flower0:['spirea'],flower1:['spirea'],flower2:['spirea'],flower3:['spirea']},
 22:{skull1:['skull'],skull2:['skull'],skull3:['skull'],skull4:['skull']},
 54:{ground:['rocks'],tree:['nest']},
 55:{woodTable:['dispelPotion']},
 58:{giant:['brauggi'],giantTeller:['brauggi'],brauggiTalker:['brauggi']},
 73:{bruno:['brigands'],brutus:['brigands']},
 82:{onFall:['waterfall']},
 84:{theRock:['secretDoor']},
 89:{troll:['sneak']},
 95:{fDoor:['brigands'],rDoor:['brigands'],brig1:['brigands'],brig2:['brigands'],brig3:['brigands'],table:['knochelkopfs'],chandelier:['knochelkopfs'],curly:['knochelkopfs'],moe:['knochelkopfs'],larry:['knochelkopfs']},
 170:{fairyFeat:['fairyDance','fairies'],firstTime:['fairyDance','fairies'],aFaery:['fairies']},
 301:{Chair:['bench'],egoOnChair:['bench'],onLargeTable:['Food','Drink'],onTable:['Food','Drink'],merchant:['abdulla'],shameen:['shameen'],shema:['shema']},
 311:{book:['register'],desk:['register']},
 320:{centaur:['hilde'],centaurBody:['hilde'],sheriffsDoor:['sheriffDoor']},
};
type SceneEntityRef={id:string;name?:string;room?:number};
function contextualNames(s:GameState,d:DialogueData,entity:SceneEntityRef):Set<string>|undefined{
 if(entity.room!==undefined&&entity.room!==s.room)return;
 const names=new Set([entity.id,entity.name||'',...(aliases[s.room]?.[entity.id]||[])].map(key));
 for(const person of d.characters.filter(p=>p.room===s.room&&(p.entityId===entity.id||p.aliases.includes(entity.id))))for(const a of [person.entityId,...person.aliases])names.add(key(a));
 return names;
}
export function contextualActions(s:GameState,c:Campaign,d:DialogueData,entity:SceneEntityRef):Action[]{
 const names=contextualNames(s,d,entity);if(!names)return [];
 return availableActions(s,c).filter(a=>a.target&&names.has(key(a.target))&&!['dialogue','move','gait'].includes(a.type));
}
/** For a deliberate owned-item-on-target gesture, find same-room active rule
 * attempts even when their prerequisites fail. This is not a menu of locked
 * actions: callers dispatch a matching attempt through act() for feedback. */
export function contextualItemAttempts(s:GameState,c:Campaign,d:DialogueData,entity:SceneEntityRef,item:string):Action[]{
 if(s.dead||s.combat||!item||(item==='silver'?s.gold*10+s.silver<=0:!(s.inventory[item]>0)))return [];
 const names=contextualNames(s,d,entity);if(!names)return [];
 const out:Action[]=[];
 for(const r of c.rules){const a=r.action;
  if(!(Array.isArray(r.room)?r.room.includes(s.room):r.room===s.room)||a.item!==item||!a.target||!names.has(key(a.target)))continue;
  if(r.once!==false&&s.flags['rule:'+r.id]||r.unless&&meets(s,r.unless))continue;
  if(!out.some(x=>JSON.stringify({...x,label:undefined})===JSON.stringify({...a,label:undefined})))out.push({...a});
 }
 return out;
}
export function validSceneEntity(room:{id:number;entities:{id:string}[]},entityId:string,originRoom:number){return room.id===originRoom&&room.entities.some(e=>e.id===entityId);}
