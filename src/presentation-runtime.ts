/** Pure renderer bridge: source NPC PolyPath targets follow caller-owned paths.
 * Does not change native state, drive the player, or acknowledge speech. */
import type {PresentationDiagnostic,PresentationMotion,PresentationResult} from './presentation-vm';

export interface SourcePoint {x:number;y:number;z?:number}
export interface PresentationDriver {
  snapshot():PresentationResult;
  advance(dtMs:number,context?:{heroPosition?:SourcePoint}):PresentationResult;
  completeMotion(actorId:string):boolean;
}
export interface PresentationRuntimeOptions {
  /** Both ends and all waypoints use source 320×190 coordinates. */
  findPath(start:SourcePoint,target:SourcePoint,actorId:string):SourcePoint[]|null|undefined;
  walkable(point:SourcePoint,actorId:string):boolean;
  /** Optional escape from a source NPC's already-invalid start. Called only
   * for the first full edge, whose endpoint must be walkable. Caller must check
   * every point against all other barriers, allow only the initially containing
   * polygons, and reject exit/re-entry. The exact edge is revalidated on every
   * partial movement; this never grants permission to later route segments. */
  canEscapeStart?(start:SourcePoint,end:SourcePoint,actorId:string):boolean;
  /** Sampling interval for collision checks; at most one source pixel. */
  collisionStep?:number;
  maxAdvanceMs?:number;
}
export interface RuntimePresentation extends PresentationResult {
  knownSourcePositions:Record<string,SourcePoint>;
  runtimeMotions:Record<string,{position:SourcePoint;target:SourcePoint;waypoints:SourcePoint[];blocked:boolean;sequence:number;escapeStart?:{start:SourcePoint;end:SourcePoint;progress:number}}>;
}
type EscapeEdge={start:SourcePoint;end:SourcePoint;progress:number};
type Route={sequence:number;position:SourcePoint;sourcePosition:SourcePoint;target:SourcePoint;waypoints:SourcePoint[];blocked:boolean;sourceRef?:string;escape?:EscapeEdge};
const finitePoint=(p:any):p is SourcePoint=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&(p.z===undefined||Number.isFinite(p.z));
const distance=(a:SourcePoint,b:SourcePoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const near=(a:SourcePoint,b:SourcePoint)=>distance(a,b)<1e-7;
function edgeProgress(point:SourcePoint,start:SourcePoint,end:SourcePoint){const dx=end.x-start.x,dy=end.y-start.y,n=dx*dx+dy*dy;if(n<1e-14)return near(point,start)?1:undefined;const t=((point.x-start.x)*dx+(point.y-start.y)*dy)/n;if(t< -1e-7||t>1+1e-7||Math.hypot(point.x-(start.x+t*dx),point.y-(start.y+t*dy))>1e-6)return undefined;return Math.max(0,Math.min(1,t));}

export class PresentationRuntime {
  private routes=new Map<string,Route>();
  private diagnostics=new Map<string,PresentationDiagnostic>();
  private current:PresentationResult;
  constructor(private readonly vm:PresentationDriver,private readonly options:PresentationRuntimeOptions){this.current=vm.snapshot();this.reconcile();}
  private diag(code:string,detail:string,id?:string,sourceRef?:string){const key=code+'|'+(id||'')+'|'+(sourceRef||'');const old=this.diagnostics.get(key);if(old){old.count++;return;}if(this.diagnostics.size<160)this.diagnostics.set(key,{code,detail,count:1,...(id?{expression:id}:{}),sourceRef});}
  private safeWalk(point:SourcePoint,id:string){try{return this.options.walkable({...point},id)===true;}catch{this.diag('runtime-walkable-error','Caller walkability check threw; movement withheld.',id);return false;}}
  private safeEscape(start:SourcePoint,end:SourcePoint,id:string){if(!this.options.canEscapeStart)return false;try{return this.options.canEscapeStart({...start},{...end},id)===true;}catch{this.diag('runtime-escape-check-error','Caller start-escape validation threw; movement withheld.',id);return false;}}
  private clearSegment(from:SourcePoint,to:SourcePoint,id:string){const length=distance(from,to),step=Math.max(.1,Math.min(1,this.options.collisionStep??1)),samples=Math.max(1,Math.ceil(length/step));if(samples>10000){this.diag('runtime-path-budget','Path segment exceeds collision-check budget.',id);return false;}for(let i=1;i<=samples;i++){const f=i/samples;if(!this.safeWalk({x:from.x+(to.x-from.x)*f,y:from.y+(to.y-from.y)*f},id))return false;}return true;}
  private plan(id:string,m:PresentationMotion,position:SourcePoint):Route {
    const start={x:position.x,y:position.y,...(position.z!==undefined?{z:position.z}:{})};
    const route:Route={sequence:m.sequence,position:start,sourcePosition:{...start},target:{x:m.x,y:m.y},waypoints:[],blocked:false,sourceRef:m.sourceRef};
    const blocked=(detail:string)=>{route.blocked=true;this.diag('runtime-path-blocked',detail,id,m.sourceRef);return route;};
    if(!finitePoint(position)||!finitePoint(route.target))return blocked('Source mover position or target is unknown.');
    if(near(position,route.target))return route;
    let found:SourcePoint[]|null|undefined;try{found=this.options.findPath({...position},{...route.target},id);}catch{return blocked('Caller pathfinder threw; NPC stays at its current rendered position.');}
    if(!Array.isArray(found)||!found.length)return blocked('No caller path to source target; completion callback withheld.');
    if(found.length>2048||found.some(p=>!finitePoint(p)))return blocked('Caller returned invalid or oversized source path.');
    const path=found.map(p=>({x:p.x,y:p.y}));while(path.length&&near(path[0],position))path.shift();
    if(!path.length||!near(path.at(-1)!,route.target))path.push({...route.target});
    // Verify the full route as well as every subsequent movement segment. Never
    // append a target through a wall merely because an A* endpoint is nearby.
    let previous=position,totalSamples=0;for(let index=0;index<path.length;index++){const point=path[index],samples=Math.ceil(distance(previous,point)/Math.max(.1,Math.min(1,this.options.collisionStep??1)));totalSamples+=samples;if(totalSamples>50000||samples>10000)return blocked('Caller path exceeds the full-edge collision-check budget.');
      if(index===0&&!this.safeWalk(previous,id)){if(!this.safeWalk(point,id)||!this.safeEscape(previous,point,id))return blocked('Source start is blocked and the caller did not validate an escape to a walkable first waypoint.');route.escape={start:{...previous},end:{...point},progress:0};}
      else if(!this.clearSegment(previous,point,id))return blocked('Caller path crosses blocked terrain; NPC remains at its current position.');previous=point;}
    route.waypoints=path;return route;
  }
  private reconcile(){
    for(const[id,route]of this.routes){const motion=this.current.motions[id],actor=this.current.actors[id];if(!motion?.deferred||id==='gEgo'||motion.sequence!==route.sequence||!actor||actor.uncertain||!finitePoint(actor)||!near(actor,route.sourcePosition))this.routes.delete(id);}
    for(const[id,m]of Object.entries(this.current.motions)){if(id==='gEgo'||!m.deferred||this.routes.has(id))continue;const p=this.current.actors[id];if(!p||p.uncertain||!finitePoint(p)){this.diag('runtime-unknown-position','Deferred NPC mover has no known source position; movement withheld.',id,m.sourceRef);continue;}this.routes.set(id,this.plan(id,m,p));}
  }
  /** Explicit retry after terrain/pathfinder availability changes; keeps position. */
  retryBlocked(actorId?:string){this.current=this.vm.snapshot();for(const[id,r]of this.routes){if(!r.blocked||(actorId&&actorId!==id))continue;const m=this.current.motions[id];if(m?.sequence===r.sequence){const plan=this.plan(id,m,r.position);plan.sourcePosition={...r.sourcePosition};this.routes.set(id,plan);}}return this.snapshot();}
  private move(dt:number){
    for(const[id,route]of [...this.routes]){if(route.blocked)continue;const m=this.current.motions[id];if(!m||m.sequence!==route.sequence)continue;
      if(![m.moveSpeed,m.xStep,m.yStep].every(v=>Number.isFinite(v)&&v>0)){route.blocked=true;this.diag('runtime-unknown-speed','NPC source movement speed/step is invalid; movement withheld.',id,m.sourceRef);continue;}
      let remaining=dt,guard=0;while(route.waypoints.length&&remaining>1e-8&&guard++<2049){const next=route.waypoints[0],dx=next.x-route.position.x,dy=next.y-route.position.y,sourceSteps=Math.max(Math.abs(dx)/m.xStep,Math.abs(dy)/m.yStep),duration=sourceSteps*m.moveSpeed*1000/60,fraction=duration<=remaining?1:remaining/duration,target={x:route.position.x+dx*fraction,y:route.position.y+dy*fraction,z:route.position.z};
        if(route.escape){const edge=route.escape,at=edgeProgress(route.position,edge.start,edge.end),to=edgeProgress(target,edge.start,edge.end);if(!near(next,edge.end)||at===undefined||to===undefined||at+1e-7<edge.progress||to+1e-7<at||!this.safeWalk(edge.end,id)||!this.safeEscape(edge.start,edge.end,id)){route.blocked=true;this.diag('runtime-escape-revoked','The captured first-edge escape is no longer valid; NPC stops without completing its callback.',id,m.sourceRef);break;}edge.progress=to;}
        else if(!this.clearSegment(route.position,target,id)){route.blocked=true;this.diag('runtime-path-blocked','Terrain became blocked during movement; NPC stops without completing its callback.',id,m.sourceRef);break;}
        route.position=target;remaining-=Math.min(remaining,duration);if(fraction===1){if(route.escape&&near(next,route.escape.end))route.escape=undefined;route.waypoints.shift();}else break;}
      if(!route.blocked&&!route.waypoints.length&&near(route.position,route.target)){
        // This is the only bridge call that mutates VM presentation state. It
        // occurs after verified physical arrival, never after failed planning.
        if(this.vm.completeMotion(id)){this.routes.delete(id);this.current=this.vm.snapshot();if(this.current.pendingSpeech?.length)return;}else{route.blocked=true;this.diag('runtime-completion-rejected','VM rejected motion completion; source callback was not synthesized.',id,m.sourceRef);}
      }
    }
  }
  advance(dtMs:number,context:{heroPosition?:SourcePoint}={}):RuntimePresentation {
    if(!Number.isFinite(dtMs)||dtMs<0)throw Error('Presentation dt must be finite and nonnegative.');
    const max=Math.min(30000,Math.max(0,this.options.maxAdvanceMs??30000));if(dtMs>max){this.diag('runtime-advance-clamped','Render advance exceeded bounded visual interval.');dtMs=max;}
    this.current=this.vm.snapshot();this.reconcile();
    // Substeps keep NPC arrival callbacks close to the VM's source timers;
    // source scripts created later in a frame do not receive its entire dt.
    let remaining=dtMs,guard=0;while(remaining>1e-8&&guard++<1801){if(this.current.pendingSpeech?.length)break;const step=Math.min(1000/60,remaining);this.move(step);if(this.current.pendingSpeech?.length)break;this.current=this.vm.advance(step,context);this.reconcile();remaining-=step;}
    return this.snapshot();
  }
  snapshot():RuntimePresentation {
    this.current=this.vm.snapshot();this.reconcile();const result=structuredClone(this.current) as RuntimePresentation;
    result.knownSourcePositions={};result.runtimeMotions={};
    for(const[id,p]of Object.entries(result.actors))if(!p.uncertain&&finitePoint(p))result.knownSourcePositions[id]={x:p.x,y:p.y,z:p.z};
    if(result.hero.positionKnown&&finitePoint(result.hero))result.knownSourcePositions.gEgo={x:result.hero.x,y:result.hero.y,z:result.hero.z};
    const translate=(rect:any,dx:number,dy:number)=>rect?{...rect,left:rect.left+dx,right:rect.right+dx,top:rect.top+dy,bottom:rect.bottom+dy}:rect;
    for(const[id,r]of this.routes){const source=result.actors[id];if(!source)continue;const dx=r.position.x-source.x,dy=r.position.y-source.y;result.knownSourcePositions[id]={...r.position};result.runtimeMotions[id]={position:{...r.position},target:{...r.target},waypoints:r.waypoints.map(p=>({...p})),blocked:r.blocked,sequence:r.sequence,...(r.escape?{escapeStart:{start:{...r.escape.start},end:{...r.escape.end},progress:r.escape.progress}}:{})};Object.assign(source,r.position);
      for(const list of [result.drawables,result.offscreenDrawables,result.conditionalDrawables])for(const d of list)if(d.entityId===id){d.x+=dx;d.y+=dy;d.rect=translate(d.rect,dx,dy);if(d.frame)d.frame={...d.frame,rect:translate(d.frame.rect,dx,dy)};d.frames=d.frames?.map((f:any)=>({...f,rect:translate(f.rect,dx,dy)}));d.renderPositionSource='caller-pathfinder';}
      for(const h of result.hotspots)if(h.entityId===id)h.rect=translate(h.rect,dx,dy);
    }
    const onscreen=(rect:any)=>rect&&rect.right>0&&rect.left<320&&rect.bottom>0&&rect.top<190;
    const known=[...result.drawables,...result.offscreenDrawables];result.drawables=[];result.offscreenDrawables=[];
    for(const d of known){const visible=!!onscreen(d.rect);d.visibility=visible?'known':'withheld';result.actors[d.entityId].onscreen=visible;if(visible){result.drawables.push(d);if(!result.hotspots.some(h=>h.entityId===d.entityId))result.hotspots.push({entityId:d.entityId,name:d.name,noun:d.noun??null,rect:{...d.rect},sourceRef:d.sourceRef,drawable:true});}else result.offscreenDrawables.push(d);}
    result.hotspots=result.hotspots.filter(h=>onscreen(h.rect));result.coverage.knownDrawables=result.drawables.length;
    result.diagnostics.push(...[...this.diagnostics.values()].map(d=>({...d})));return result;
  }
}
export function createPresentationRuntime(vm:PresentationDriver,options:PresentationRuntimeOptions){return new PresentationRuntime(vm,options);}
