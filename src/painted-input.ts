import {meets,type Condition,type GameState} from './rules';
import type {ScenePassage,SceneRect} from './scene-interface';
export interface PaintedHotspot extends SceneRect {entityId:string;label?:string;when?:Condition;unless?:Condition;visual?:'wire'|'bridge';}
export interface PaintedPassage {passageId:string;hitRects:SceneRect[];approach?:{x:number;y:number};copyOf?:string;entityId?:string;kind?:string;when?:Condition;}
export interface PaintedInput {hotspots?:Record<string,PaintedHotspot[]>;passages?:Record<string,PaintedPassage[]>;}
export function paintedHotspots(s:GameState,mode:string,data:PaintedInput,entities:{id:string}[]):PaintedHotspot[]{
 if(mode!=='modern')return [];
 const ids=new Set(entities.map(e=>e.id));return (data.hotspots?.[String(s.room)]||[]).filter(h=>ids.has(h.entityId)&&meets(s,h.when)&&!(h.unless&&meets(s,h.unless)));
}
export function paintedPassages(room:number,mode:string,data:PaintedInput,passages:ScenePassage[],state?:GameState):ScenePassage[]{
 if(mode!=='modern')return passages;
 const authored=data.passages?.[String(room)]||[];
 const adjusted=passages.map(p=>{const a=authored.find(a=>!a.copyOf&&a.passageId===p.id);return a?{...p,hitRects:a.hitRects,approach:a.approach||p.approach,controlMask:undefined}:p;});
 // A second visible entrance may reuse an existing authorized connection, but
 // cannot invent a new destination or remove that connection's prerequisites.
 const copies=authored.filter(a=>a.copyOf).flatMap(a=>{const p=passages.find(p=>p.id===a.copyOf);if(!p||a.when&&(!state||!meets(state,a.when)))return [];return [{...p,id:a.passageId,entityId:a.entityId||p.entityId,kind:a.kind||p.kind,hitRects:a.hitRects,approach:a.approach||p.approach,controlMask:undefined}];});
 return [...adjusted,...copies];
}
