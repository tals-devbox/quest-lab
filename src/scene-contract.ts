/** Art-dependent geometry is separate from source behavior and source picture masks. */
import {meets,type GameState,type Condition} from './rules';
export type Point=[number,number];
export interface Region {points:Point[];when?:Condition;unless?:Condition;}
export interface Occluder extends Region {id:string;baselineY:number;}
export interface SceneContract {
 mode:'world'|'close-up'|'minigame'|'cinematic';
 sourceRefs?:string[];review?:string;
 modern?:{background:string;replaceWalkmesh?:boolean;walkable?:Region[];blocked?:Region[];occluders?:Occluder[]};
}
export interface SceneContracts {schemaVersion:1;rooms:Record<string,SceneContract>;}
export const WORLD:SceneContract={mode:'world',review:'Imported geometry; painted alignment not yet reviewed.'};
export function sceneContract(id:number,contracts:SceneContracts,override?:SceneContract):SceneContract{return override||contracts.rooms[id]||WORLD;}
export const worldScene=(c:SceneContract)=>c.mode==='world';
export function inside(points:Point[],x:number,y:number){let hit=false;for(let i=0,k=points.length-1;i<points.length;k=i++){const a=points[i],b=points[k];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
const active=(r:Region,s:GameState)=>meets(s,r.when)&&(!r.unless||!meets(s,r.unless));
export function paintedGeometry(c:SceneContract,background:string|undefined){return c.modern?.background===background?c.modern:undefined;}
export function paintedWalkable(c:SceneContract,background:string|undefined,s:GameState,x:number,y:number):boolean|undefined{
 if(!worldScene(c))return false;const g=paintedGeometry(c,background);if(!g)return undefined;
 if(g.blocked?.some(r=>active(r,s)&&inside(r.points,x,y)))return false;
 if(g.replaceWalkmesh)return !!g.walkable?.some(r=>active(r,s)&&inside(r.points,x,y));return undefined;
}
/** Use the same authored boundaries for endpoint checks AND every path segment. */
export function paintedPathPolygons(c:SceneContract,background:string|undefined,s:GameState,sourcePolygons:{type:string;points?:number[][]}[]=[]){
 const g=paintedGeometry(c,background);if(!g)return;
 return [...(g.replaceWalkmesh?(g.walkable||[]).filter(r=>active(r,s)).map(r=>({type:'PContainedAccess',points:r.points})):sourcePolygons),...(g.blocked||[]).filter(r=>active(r,s)).map(r=>({type:'PBarredAccess',points:r.points}))];
}
/** Depth is the object's ground-contact Y, not its painted top or SCI priority band. */
export function paintedPriority(c:SceneContract,background:string|undefined,s:GameState):Uint8Array|undefined{
 const g=paintedGeometry(c,background),regions=g?.occluders?.filter(r=>active(r,s));if(!regions?.length)return;
 const bytes=new Uint8Array(320*190);for(const r of regions)for(let y=0;y<190;y++)for(let x=0;x<320;x++)if(inside(r.points,x+.5,y+.5))bytes[y*320+x]=Math.max(bytes[y*320+x],Math.round(r.baselineY)+1);return bytes;
}
export function validateSceneContract(c:any,label='scene'):string[]{
 const errors:string[]=[];if(!c||!['world','close-up','minigame','cinematic'].includes(c.mode))return [label+': invalid presentation mode'];
 if(c.sourceRefs!==undefined&&(!Array.isArray(c.sourceRefs)||c.sourceRefs.some((r:any)=>typeof r!=='string')))errors.push(label+': invalid source references');
 const g=c.modern;if(!g)return errors;
 if(typeof g.background!=='string'||!g.background.startsWith('/')||g.background.startsWith('//')||g.background.includes('..'))errors.push(label+': invalid background binding');
 for(const name of ['walkable','blocked','occluders']){const regions=g[name];if(regions===undefined)continue;if(!Array.isArray(regions)){errors.push(label+': invalid '+name);continue;}for(const r of regions){if(!Array.isArray(r?.points)||r.points.length<3||r.points.length>256||r.points.some((p:any)=>!Array.isArray(p)||p.length!==2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||p[0]<0||p[0]>320||p[1]<0||p[1]>190))errors.push(label+': invalid '+name+' polygon');else if(Math.abs(r.points.reduce((area:number,p:Point,i:number)=>{const q=r.points[(i+1)%r.points.length];return area+p[0]*q[1]-q[0]*p[1];},0))<1)errors.push(label+': empty '+name+' polygon');if(name==='occluders'&&(typeof r.id!=='string'||!Number.isFinite(r.baselineY)||r.baselineY<0||r.baselineY>189))errors.push(label+': invalid occluder depth');}}
 if(g.replaceWalkmesh&&(!Array.isArray(g.walkable)||g.walkable.length===0))errors.push(label+': replacement walkmesh needs a walkable region');
 if(g.replaceWalkmesh&&Array.isArray(g.walkable)&&g.walkable.length>1)errors.push(label+': use one outer walkable polygon and blocked polygons for holes');
 if(c.mode!=='world'&&(g.walkable?.length||g.occluders?.length))errors.push(label+': non-world scenes cannot define world geometry');
 return errors;
}
