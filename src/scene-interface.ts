import {availableActions,meets,type Action,type Campaign,type Condition,type GameState} from './rules';
import {topicsFor,type DialogueData,type DialogueTopic} from './dialogue';

export interface SceneRect {left:number;top:number;right:number;bottom:number}
export interface ScenePassage {id:string;to:number;kind:string;entityId?:string;direction?:string;hitRects:SceneRect[];approach?:{x:number;y:number};requires?:Condition;sourceRefs:string[];status?:string;blocked?:string;arrival?:{day?:any;night?:any};controlMask?:{url:string;mask:number;colors?:number[]}}
export interface SceneNavigation {rooms:Record<string,{passages:ScenePassage[];unmappedNativeExits?:number[]}>}
export const scenePassages=(s:GameState,c:Campaign,n:SceneNavigation):ScenePassage[] => (n.rooms[String(s.room)]?.passages||[]).filter(p=>c.rooms.some(r=>r.id===p.to));
export const passageOpen=(s:GameState,p:ScenePassage)=>meets(s,p.requires);
export function passageHit(p:ScenePassage,x:number,y:number,control?:Uint8Array){if(!p.hitRects.some(r=>x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom))return false;if(p.controlMask){if(!control)return false;const color=control[Math.floor(y)*320+Math.floor(x)];return !!((1<<color)&p.controlMask.mask);}return true;}
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
 301:{Chair:['bench'],egoOnChair:['bench'],onLargeTable:['Food','Drink'],onTable:['Food','Drink'],merchant:['abdulla'],shameen:['shameen'],shema:['shema']},
 320:{centaur:['hilde'],centaurBody:['hilde'],sheriffsDoor:['sheriffDoor']},
};
export function contextualActions(s:GameState,c:Campaign,d:DialogueData,entity:{id:string;name?:string;room?:number}):Action[]{
 if(entity.room!==undefined&&entity.room!==s.room)return [];
 const names=new Set([entity.id,entity.name||'',...(aliases[s.room]?.[entity.id]||[])].map(key));
 for(const person of d.characters.filter(p=>p.room===s.room&&(p.entityId===entity.id||p.aliases.includes(entity.id))))for(const a of [person.entityId,...person.aliases])names.add(key(a));
 return availableActions(s,c).filter(a=>a.target&&names.has(key(a.target))&&!['dialogue','move','gait'].includes(a.type));
}
export function validSceneEntity(room:{id:number;entities:{id:string}[]},entityId:string,originRoom:number){return room.id===originRoom&&room.entities.some(e=>e.id===entityId);}
