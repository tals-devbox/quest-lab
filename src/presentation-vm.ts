/** Bounded, read-only SCI presentation interpreter. Never executes native game rules.
 * Input is the compact AST produced by import-sci's proper parser. Unsupported
 * predicates remain unknown; this is deliberately not a general SCI interpreter. */
import type {Condition,GameState} from './rules';

export interface SourceMethod {name:string;sourceRef:string;ast:any[]}
export interface SourceDefinition {id:string;base?:string;module?:number;properties?:Record<string,any>;methods:SourceMethod[];sourceRef:string;name?:string}
export interface SourceRoom {id:number;instance:string;name?:string;properties?:Record<string,any>;methods:SourceMethod[];entities:SourceDefinition[];scripts:SourceDefinition[];sourceRef:string;[key:string]:any}
export interface PresentationOptions {
  initialLocals?:Record<string,any>; sharedDefinitions?:SourceDefinition[];
  sharedLocals?:Record<string,Record<string,any>>; procedures?:{name:string;sourceRef:string;ast:any[]}[];
  heroPosition?:{x:number;y:number;z?:number}; entryEdge?:string|number;
  /** Explicit caller-owned presentation episode; not inferred from a quest write. */
  resumeScripts?:{id:string;owner?:string;state?:number}[];
  maxSteps?:number;maxAdvanceMs?:number;
  audioDefaults?:Record<string,any>;
  initialAudio?:Record<string,Record<string,any>>;
}
export interface PresentationDiagnostic {code:string;sourceRef?:string;expression?:any;detail:string;count:number}
export interface PresentationMotion {kind:string;x:number;y:number;deferred:boolean;sequence:number;sourceRef?:string;moveSpeed:number;xStep:number;yStep:number}
export interface SourceAudioEvent {sequence:number;dedupeKey:string;atMs:number;objectId:string;command:string;number:number|null;loop:number|null;volume:number|null;priority:number|null;sourceRef?:string;arguments?:(number|null)[]}
export interface PresentationResult {
  room:number;drawables:any[];offscreenDrawables:any[];conditionalDrawables:any[];hotspots:any[];hero:any;
  actors:Record<string,any>;diagnostics:PresentationDiagnostic[];
  motions:Record<string,PresentationMotion>;
  audioSession:number;audioEvents:SourceAudioEvent[];audioRequests:SourceAudioEvent[];audioState:Record<string,any>;
  scripts:{id:string;owner:string;state:number;active:boolean;blocked:boolean;timerMs:number|null;sourceRef?:string}[];
  coverage:{knownDrawables:number;withheldDrawables:number;steps:number;timedCallbacks:number;complete:false};
}
type PresentationState=GameState&{previousRoom?:number};
type Scope={self:string;module:string;script?:string;ownerHint?:string;parameters?:Map<string,any>;sourceRef?:string};
type Actor=Record<string,any>&{active:boolean;hidden:boolean;uncertain:boolean;activation:string[];conditional:any[]};
type Motion={kind:string;x:number;y:number;callback?:string;elapsed:number;sourceRef?:string;deferred:boolean;sequence:number};
type Cycle={kind:string;target?:number;direction:number;callback?:string;elapsed:number};
type ScriptState={id:string;owner:string;state:number;active:boolean;timer:number|null;blocked:boolean;scope:string};
const UNKNOWN=Symbol('unknown');
let nextAudioSession=0;
const audioDefaultState={number:0,loop:1,vol:127,priority:0,signal:0,prevSignal:0,playing:false,paused:false,uncertain:false}; // Sound.sc properties
const statNames=['strength','intelligence','agility','vitality','luck','weaponUse','parry','dodge','stealth','pickLocks','throwing','climbing','magic','experience','health','stamina','mana'];
const scalar=(v:any)=>typeof v==='number'||typeof v==='boolean'||typeof v==='string';
const finite=(v:any):v is number=>typeof v==='number'&&Number.isFinite(v);
const selector=(v:any):v is string=>typeof v==='string'&&v.endsWith(':');
const drawingDefaults={x:0,y:0,z:0,view:-1,loop:0,cel:0,priority:0,cycleSpeed:6,moveSpeed:6,xStep:3,yStep:2,scaleX:128,scaleY:128,script:0,cycler:0,mover:0};
const ignoredKernels=new Set(['Load','LoadMany','Unload','DisposeScript','PalVary','AssertPalette','Palette','HandsOn','HandsOff','NormalEgo','EgoGait','Cursor','SetCursor','SL','Said','Print','DrawPic','Graph','Show','SetPort','ShakeScreen','Memory','SetDebug','Animate','BaseSetter','SetNowSeen','SetNowSeenRect']);
const gameplayKernels=new Set(['SetFlag','ClearFlag','SolvePuzzle','SkillUsed','TrySkill','EatMeal','NextDay','EgoDead','SatisfyQuest','Award','GetItem','GetMoney','NewRoom','AddScore']);
const ignoredSelectors=new Set(['ignoreActors:','ignoreControl:','illegalBits:','actions:','approachVerbs:','stopUpd:','startUpd:','forceUpd:','setHeading:','setStep:','signal:','detailLevel:','setRegions:','setFeatures:','addObstacle:','delete:','add:','eachElementDo:','doit:','setScale:','setScaler:','normal:']);

/** Source Main.sc time phases; gClock is native minutes *2.5. */
export function sourceTimeOfDay(minutes:number):number {
  return minutes>=1380?6:minutes>=1200?5:minutes>=1020?4:minutes>=840?3:minutes>=660?2:minutes>=480?1:minutes>=300?0:minutes>=120?7:6;
}
export class PresentationVM {
  private state:PresentationState;private readonly defs=new Map<string,SourceDefinition>();
  private readonly actors=new Map<string,Actor>();private readonly variables=new Map<string,Map<string,any>>();
  private readonly scripts=new Map<string,ScriptState>();private readonly motions=new Map<string,Motion>();private readonly cycles=new Map<string,Cycle>();
  private readonly diagnosticMap=new Map<string,PresentationDiagnostic>();private readonly callStack=new Map<string,number>();
  private readonly procedures=new Map<string,{name:string;sourceRef:string;ast:any[]}>();
  private steps=0;private budgetSteps=0;private budgetDepth=0;private callbacks=0;private tickRemainder=0;private elapsed=0;private motionSequence=0;private features=new Set<string>();
  private conditionalKeys=new WeakMap<Actor,Map<string,any>>();
  private audioSession=++nextAudioSession;private audioSequence=0;private audioStates=new Map<string,Record<string,any>>();private audioEvents:SourceAudioEvent[]=[];
  constructor(private readonly room:SourceRoom,state:PresentationState,private readonly sourceFlags:Record<string,Condition|boolean|number>,private readonly assets:any,private readonly options:PresentationOptions={}) {
    this.state=structuredClone(state);
    for(const id of ['gLongSong','gLongSong2','gShortSong'])this.audioStates.set(id,{...audioDefaultState,...structuredClone(options.audioDefaults||{}),...structuredClone(options.initialAudio?.[id]||{})});
    for(const d of room.entities.filter(d=>d.base==='Sound'))this.audioStates.set(d.id,{...audioDefaultState,...structuredClone(options.audioDefaults||{}),...structuredClone(d.properties||{}),...structuredClone(options.initialAudio?.[d.id]||{})});
    this.variables.set('room',new Map(Object.entries(structuredClone(options.initialLocals||{}))));
    for(const d of [...room.entities,...room.scripts,...options.sharedDefinitions||[]]){this.defs.set(d.id,d);if(d.module!==undefined&&d.module!==room.id&&!this.variables.has(String(d.module)))this.variables.set(String(d.module),new Map(Object.entries(structuredClone(options.sharedLocals?.[d.id]||{}))));}
    this.defs.set(room.instance,{id:room.instance,properties:room.properties,methods:room.methods,sourceRef:room.sourceRef});
    for(const e of room.entities)this.actors.set(e.id,{...drawingDefaults,...structuredClone(e.properties||{}),active:false,hidden:false,uncertain:false,activation:[],conditional:[]});
    this.actors.set('gEgo',{...drawingDefaults,view:0,x:null,y:null,active:false,hidden:false,uncertain:false,activation:[],conditional:[],assignments:[],edgeHit:options.entryEdge??UNKNOWN,...options.heroPosition});
    for(const p of options.procedures||[])this.procedures.set(p.name,p);
    if(!options.initialLocals)this.diag('missing-locals','No declared-local metadata supplied; uninitialized locals remain unknown.',room.sourceRef);
    this.withBudget(()=>{this.method(room.instance,'init',{self:room.instance,module:'room'});for(const s of options.resumeScripts||[])this.startScript(s.id,s.owner,s.state);});
  }
  private diag(code:string,detail:string,sourceRef?:string,expression?:any){const key=code+'|'+(sourceRef||'')+'|'+JSON.stringify(expression??detail);const prior=this.diagnosticMap.get(key);if(prior){prior.count++;return;}if(this.diagnosticMap.size<240)this.diagnosticMap.set(key,{code,detail,sourceRef,...(expression!==undefined?{expression}:{}),count:1});}
  private withBudget<T>(run:()=>T):T {if(this.budgetDepth===0)this.budgetSteps=0;this.budgetDepth++;try{return run();}finally{this.budgetDepth--;}}
  private allowed(ctx:Scope){this.steps++;if(++this.budgetSteps<=(this.options.maxSteps??120000))return true;this.diag('budget-exhausted','Presentation instruction budget exhausted for this operation; next advance gets a fresh budget.',ctx.sourceRef);return false;}
  private rememberConditional(actor:Actor,entry:any){let keys=this.conditionalKeys.get(actor);if(!keys){keys=new Map();this.conditionalKeys.set(actor,keys);}const key=JSON.stringify(entry),prior=keys.get(key);if(prior){prior.count++;return;}if(keys.size>=32){this.diag('conditional-limit','Actor ambiguity trace capped at32 unique conditions.',entry.sourceRef);return;}const saved={...entry,count:1};keys.set(key,saved);actor.conditional.push(saved);}
  private moduleFor(id:string){const d=this.defs.get(id);return d?.module!==undefined&&d.module!==this.room.id?String(d.module):'room';}
  private get(name:string,ctx:Scope):any {
    if(ctx.parameters?.has(name))return ctx.parameters.get(name);
    if(name==='self')return ctx.self;if(name==='gCurRoom')return this.room.instance;if(name==='client')return ctx.ownerHint||(ctx.script?this.scripts.get(ctx.script)?.owner:undefined)||UNKNOWN;
    if(name==='gNight')return +(this.state.minutes>=1200||this.state.minutes<300);
    if(name==='gTimeOfDay')return sourceTimeOfDay(this.state.minutes);
    if(name==='gClock')return this.state.minutes*2.5;if(name==='gDay')return this.state.day;
    if(name==='gCurRoomNum')return this.room.id;if(name==='gPrevRoomNum')return this.state.previousRoom??0;
    if(name==='gHowFast'||name==='gHowFastCast')return 1;if(name==='gEgoClass')return {fighter:1,'magic-user':2,thief:3}[this.state.heroClass];
    if(name==='true')return 1;if(name==='false'||name==='NULL')return 0;
    if(name.startsWith('EDGE_'))return name;
    if(name==='state'&&ctx.script)return this.scripts.get(ctx.script)?.state??UNKNOWN;
    if(this.actors.get(ctx.self)&&Object.hasOwn(this.actors.get(ctx.self)!,name))return this.actors.get(ctx.self)![name];
    const local=this.variables.get(ctx.module);if(local?.has(name))return local.get(name)??UNKNOWN;
    if(this.defs.has(name)||this.audioStates.has(name))return name;
    return UNKNOWN;
  }
  private assign(target:any,value:any,ctx:Scope):any {
    if(target?.$array){const [base,index]=target.$array,offset=this.value(index,ctx);if(typeof base==='string'&&/^local\d+$/.test(base)&&finite(offset))return this.assign('local'+(Number(base.slice(5))+offset),value,ctx);this.diag('unsupported-write','Unsupported array write was suppressed.',ctx.sourceRef,target);return UNKNOWN;}
    if(typeof target!=='string')return UNKNOWN;
    if(/^global\d+$|^g[A-Z]/.test(target)){this.diag('suppressed-gameplay-write','Source global write is suppressed; native state is authoritative.',ctx.sourceRef,[target,value===UNKNOWN?'unknown':value]);return value;}
    const running=ctx.script&&this.scripts.get(ctx.script);
    if(running&&['ticks','cycles','seconds'].includes(target)){if(finite(value)&&value>=0)running.timer=value*(target==='seconds'?1000:target==='ticks'?1000/60:1000/60);else{running.blocked=true;this.diag('unknown-timer','Cannot schedule unknown presentation delay.',ctx.sourceRef,target);}return value;}
    if(target==='state'&&running){if(finite(value))running.state=value;return value;}
    if(ctx.parameters?.has(target)||/^temp\d+$|^param\d+$/.test(target)){ctx.parameters?.set(target,value);return value;}
    if(this.actors.has(ctx.self)&&Object.hasOwn(this.actors.get(ctx.self)!,target)){this.actors.get(ctx.self)![target]=value;return value;}
    if(!this.variables.has(ctx.module))this.variables.set(ctx.module,new Map());this.variables.get(ctx.module)!.set(target,value);return value;
  }
  private condition(c:any):any {
    if(typeof c==='boolean'||c===0||c===1)return +!!c;if(!c||typeof c!=='object')return UNKNOWN;
    const known=new Set(['flag','notFlag','item','count','skill','min','silver','heroClass','night','minuteMin','minuteMax','dayFlag','spell','stat','equals','all','any','not']);if(Object.keys(c).some(k=>!known.has(k))||!Object.keys(c).length)return UNKNOWN;
    if(!['flag','notFlag','item','skill','silver','heroClass','night','minuteMin','minuteMax','dayFlag','spell','stat','all','any','not'].some(k=>Object.hasOwn(c,k)))return UNKNOWN;
    if(['flag','notFlag','item','skill','dayFlag','spell','stat'].some(k=>Object.hasOwn(c,k)&&(typeof c[k]!=='string'||!c[k])))return UNKNOWN;
    if(['all','any'].some(k=>Object.hasOwn(c,k)&&!Array.isArray(c[k])))return UNKNOWN;
    const parts:any[]=[];if(c.all)parts.push(this.and(c.all.map((x:any)=>this.condition(x))));if(c.any)parts.push(this.or(c.any.map((x:any)=>this.condition(x))));if(c.not){const q=this.condition(c.not);parts.push(q===UNKNOWN?UNKNOWN:+!q);}
    if(c.flag)parts.push(+!!this.state.flags[c.flag]);if(c.notFlag)parts.push(+!this.state.flags[c.notFlag]);
    if(c.item)parts.push(+((this.state.inventory[c.item]||0)>=(c.count??1)));if(c.skill)parts.push(+((this.state.stats[c.skill]||0)>=(c.min??1)));
    if(c.silver!==undefined)parts.push(+(this.state.silver+this.state.gold*10>=c.silver));if(c.heroClass)parts.push(+(this.state.heroClass===c.heroClass));
    if(c.night!==undefined)parts.push(+((this.state.minutes>=1200||this.state.minutes<300)===c.night));if(c.minuteMin!==undefined)parts.push(+(this.state.minutes>=c.minuteMin));if(c.minuteMax!==undefined)parts.push(+(this.state.minutes<=c.minuteMax));
    if(c.dayFlag)parts.push(+(this.state.stats['day:'+c.dayFlag]!==this.state.day));if(c.spell)parts.push(+this.state.spells.includes(c.spell));if(c.stat)parts.push(+((this.state.stats[c.stat]||0)===c.equals));
    return this.and(parts);
  }
  private and(values:any[]){return values.some(v=>v!==UNKNOWN&&!v)?0:values.includes(UNKNOWN)?UNKNOWN:1;}
  private or(values:any[]){return values.some(v=>v!==UNKNOWN&&!!v)?1:values.includes(UNKNOWN)?UNKNOWN:0;}
  private value(node:any,ctx:Scope):any {
    if(typeof node==='number'||typeof node==='boolean')return node;if(typeof node==='string')return this.get(node,ctx);
    if(node?.$string!==undefined)return node.$string;
    if(node?.$array){const [base,index]=node.$array,i=this.value(index,ctx);if(base==='gEgoStats'&&finite(i))return this.state.stats[statNames[i]]??UNKNOWN;if(typeof base==='string'&&/^local\d+$/.test(base)&&finite(i))return this.get('local'+(Number(base.slice(5))+i),ctx);return UNKNOWN;}
    if(!Array.isArray(node)||!node.length)return UNKNOWN;const [op,...args]=node;
    if(op==='=')return this.assign(args[0],this.value(args[1],ctx),ctx);
    if(['++','--','+=','-=','*=','/=','|=','&='].includes(op)){const a=this.value(args[0],ctx),b=args.length>1?this.value(args[1],ctx):1;if(a===UNKNOWN||b===UNKNOWN)return this.assign(args[0],UNKNOWN,ctx);return this.assign(args[0],op==='++'||op==='+='?a+b:op==='--'||op==='-='?a-b:op==='*='?a*b:op==='/='?Math.trunc(a/b):op==='|='?a|b:a&b,ctx);}
    if(op==='not'){const v=this.value(args[0],ctx);return v===UNKNOWN?UNKNOWN:+!v;}
    if(op==='and'){const values=[];for(const a of args){const v=this.value(a,ctx);if(v!==UNKNOWN&&!v)return 0;values.push(v);}return this.and(values);}
    if(op==='or'){const values=[];for(const a of args){const v=this.value(a,ctx);if(v!==UNKNOWN&&v)return 1;values.push(v);}return this.or(values);}
    if(op==='IsFlag'){const n=this.value(args[0],ctx);if(n===UNKNOWN)return UNKNOWN;const rule=this.sourceFlags[String(n)];if(rule===undefined){this.diag('unknown-flag','No native mapping for source flag.',ctx.sourceRef,n);return UNKNOWN;}return this.condition(rule);}
    if(op==='IsObject'){const id=this.target(args[0],ctx);return id===UNKNOWN?UNKNOWN:+(this.actors.has(id)||this.defs.has(id));}
    if(op==='Random'){const lo=this.value(args[0],ctx),hi=this.value(args[1],ctx);if(lo===hi&&lo!==UNKNOWN)return lo;this.diag('unsupported-random','Random branch is not sampled by read-only presentation.',ctx.sourceRef,node);return UNKNOWN;}
    if(op==='SoundFX'){const number=this.value(args[0],ctx);if(args.length===1&&finite(number)&&Number.isInteger(number)&&number>=0&&number<=65535)return number;this.diag('unknown-audio-number','SoundFX identity helper requires one known numeric source number (n814.sc:554).',ctx.sourceRef,node);return UNKNOWN;}
    if(op==='if'){const v=this.value(args[0],ctx),cut=args.indexOf('else');if(v===UNKNOWN)return UNKNOWN;const body=v?args.slice(1,cut<0?undefined:cut):cut<0?[]:args.slice(cut+1);let result:any=0;for(const item of body)result=this.value(item,ctx);return result;}
    if(typeof op==='string'&&['+','-','*','/','mod','&','|','^','<<','>>','==','!=','<','>','<=','>=','OneOf','oneOf'].includes(op)){const vals=args.map(n=>this.value(n,ctx));if(vals.includes(UNKNOWN))return UNKNOWN;if(op==='OneOf'||op==='oneOf')return +vals.slice(1).includes(vals[0]);if(op==='==')return +vals.every(v=>v===vals[0]);if(op==='!=')return +(vals[0]!==vals[1]);if(['<','>','<=','>='].includes(op))return +vals.slice(1).every((v,i)=>op==='<'?vals[i]<v:op==='>'?vals[i]>v:op==='<='?vals[i]<=v:vals[i]>=v);if(op==='+')return vals.reduce((a,b)=>a+b,0);if(op==='-')return vals.length===1?-vals[0]:vals.slice(1).reduce((a,b)=>a-b,vals[0]);if(op==='*')return vals.reduce((a,b)=>a*b,1);if(op==='/')return vals[1]?Math.trunc(vals[0]/vals[1]):UNKNOWN;if(op==='mod')return vals[1]?vals[0]%vals[1]:UNKNOWN;return op==='&'?vals[0]&vals[1]:op==='|'?vals[0]|vals[1]:op==='^'?vals[0]^vals[1]:op==='<<'?vals[0]<<vals[1]:vals[0]>>vals[1];}
    const id=this.target(op,ctx);if(typeof id==='string'&&this.audioStates.has(id)&&args.length===1&&selector(args[0]))return this.audioStates.get(id)![args[0].slice(0,-1)]??UNKNOWN;
    if(typeof id==='string'&&this.actors.has(id)&&args[0]==='inRect:'){const actor=this.actors.get(id)!,bounds=args.slice(1).map(n=>this.value(n,ctx));if(bounds.length!==4||!bounds.every(finite)||!finite(actor.x)||!finite(actor.y)){this.diag('unknown-actor-query','Actor.inRect requires known source position and four numeric bounds.',ctx.sourceRef,node);return UNKNOWN;}return +(bounds[0]<=actor.x&&actor.x<bounds[2]&&bounds[1]<=actor.y&&actor.y<bounds[3]);} // Actor.sc:686, half-open bounds
    if(typeof id==='string'&&(this.actors.has(id)||id===this.room.instance)&&args.length===1&&selector(args[0])){const key=args[0].slice(0,-1);if(id===this.room.instance){if(key==='script')return [...this.scripts.values()].find(s=>s.owner===id&&s.active)?.id??0;return this.room.properties?.[key]??UNKNOWN;}const actor=this.actors.get(id)!;if(key==='script')return actor.script||0;if(key==='lastCel')return this.frames(actor.view,actor.loop).length-1;return actor[key]??UNKNOWN;}
    if(this.procedures.has(op)){const proc=this.procedures.get(op)!;return this.invokeBody(proc.ast,ctx,args,proc.sourceRef);}
    return UNKNOWN;
  }
  private target(node:any,ctx:Scope):any {if(typeof node==='string'){if(node==='self')return ctx.self;if(node==='gCurRoom')return this.room.instance;if(this.audioStates.has(node)||this.defs.has(node)||this.actors.has(node)||this.scripts.has(node))return node;const v=this.get(node,ctx);return typeof v==='string'?v:UNKNOWN;}return UNKNOWN;}
  private unknownBranches(body:any[],ctx:Scope,expression:any){
    this.diag('unknown-predicate','Source branch withheld because its predicate is unknown.',ctx.sourceRef,expression);
    const visited=new Set<string>();
    const walk=(node:any,scope=ctx,depth=0)=>{if(!Array.isArray(node)||depth>8)return;const id=this.target(node[0],scope);
      if(this.audioStates.has(id)&&node.slice(1).some(selector)){this.audioStates.get(id)!.uncertain=true;this.diag('unknown-audio-predicate','Audio branch withheld; current sound state may be affected.',ctx.sourceRef,{objectId:id,expression});}
      if(this.actors.has(id)){const p=this.actors.get(id)!;const selectors=node.slice(1).filter(selector);
        if(selectors.some(v=>['init:','show:','hide:','dispose:','posn:','x:','y:','z:','view:','setMotion:'].includes(v))){p.uncertain=true;this.rememberConditional(p,{expression,sourceRef:ctx.sourceRef});}
        else if(selectors.some(v=>!ignoredSelectors.has(v))){p.poseUncertain=true;this.diag('unknown-pose','Actor presence is known, but its source pose branch is withheld; retains last known pose.',ctx.sourceRef,id);}
        const start=node.indexOf('setScript:');if(start>=0){const name=node[start+1],definition=this.defs.get(name);if(definition?.methods.length&&!visited.has(name)){visited.add(name);for(const method of definition.methods)for(const child of method.ast.slice(2))walk(child,{...scope,self:name,ownerHint:id},depth+1);}else if(name!==0&&!definition){p.uncertain=true;this.rememberConditional(p,{expression,sourceRef:ctx.sourceRef,reason:'unknown script may change actor visibility'});}}
      }
      // An unknown branch must not leave an old local value falsely authoritative.
      if(node[0]==='=')this.assign(node[1],UNKNOWN,scope);for(const child of node)walk(child,scope,depth+1);
    };for(const node of body)walk(node);
  }
  private invokeBody(ast:any[],ctx:Scope,args:any[],sourceRef:string):any {const params=new Map<string,any>(),header=ast[1]||[];let tmp=false,index=0;for(const name of header.slice(1)){if(name==='&tmp'){tmp=true;continue;}if(name==='&rest')continue;if(typeof name==='string')params.set(name,tmp?0:index<args.length?this.value(args[index++],ctx):UNKNOWN);}const next={...ctx,parameters:params,sourceRef};let result:any=0;for(const n of ast.slice(2)){if(Array.isArray(n)&&n[0]==='return')return n.length>1?this.value(n[1],next):0;result=this.exec(n,next);}return result;}
  private method(id:string,name:string,ctx:Scope,args:any[]=[]){const d=this.defs.get(id),m=d?.methods.find(m=>m.name===name);if(!m)return;const key=id+':'+name,depth=this.callStack.get(key)||0;if(depth>=(name==='changeState'?32:1)){this.diag('recursion-blocked','Recursive presentation method blocked.',m.sourceRef);return;}this.callStack.set(key,depth+1);try{return this.invokeBody(m.ast,{...ctx,self:id,module:this.moduleFor(id)},args,m.sourceRef);}finally{if(depth)this.callStack.set(key,depth);else this.callStack.delete(key);}}
  private exec(node:any,ctx:Scope):any {
    if(!Array.isArray(node)||!node.length||!this.allowed(ctx))return 0;let[op,...args]=node;
    if(op==='if'){const c=this.value(args[0],ctx),cut=args.indexOf('else'),yes=args.slice(1,cut<0?undefined:cut),no=cut<0?[]:args.slice(cut+1);if(c===UNKNOWN){this.unknownBranches([...yes,...no],ctx,args[0]);return UNKNOWN;}for(const n of c?yes:no)this.exec(n,ctx);return c;}
    if(op==='cond'){for(let i=0;i<args.length;i++){const branch=args[i];if(!Array.isArray(branch))continue;const c=branch[0]==='else'?1:this.value(branch[0],ctx);if(c===UNKNOWN){this.unknownBranches(args.slice(i),ctx,branch[0]);return UNKNOWN;}if(c){for(const n of branch.slice(1))this.exec(n,ctx);break;}}return 0;}
    if(op==='switch'){const c=this.value(args[0],ctx);if(c===UNKNOWN){this.unknownBranches(args.slice(1),ctx,args[0]);return UNKNOWN;}for(const branch of args.slice(1)){if(!Array.isArray(branch))continue;const test=branch[0]==='else'?c:this.value(branch[0],ctx);if(test===UNKNOWN){this.unknownBranches(args.slice(1),ctx,branch[0]);return UNKNOWN;}if(test===c){for(const n of branch.slice(1))this.exec(n,ctx);break;}}return 0;}
    if(['=','++','--','+=','-=','*=','/=','|=','&='].includes(op))return this.value(node,ctx);
    if(op==='return')return args.length?this.value(args[0],ctx):0;
    if(op==='SoundFX')return this.value(node,ctx);
    if(gameplayKernels.has(op)){this.diag('suppressed-gameplay-write','Native gameplay effect was not executed.',ctx.sourceRef,node);return 0;}
    if(ignoredKernels.has(op))return 0;
    if(op==='gMessager'&&args[0]==='say:'){const callbacks=args.slice(1).filter(n=>n==='self'||typeof n==='string'&&this.scripts.has(n));if(callbacks.length&&ctx.script){const script=this.scripts.get(ctx.script);if(script)script.blocked=true;this.diag('speech-callback-blocked','Speech completion requires caller acknowledgement; not skipped automatically.',ctx.sourceRef,node);}return 0;}
    if(this.procedures.has(op))return this.value(node,ctx);
    if(op==='gFeatures'&&(args.includes('add:')||args.includes('setFeatures:'))){const start=args.findIndex(v=>v==='add:'||v==='setFeatures:');for(const n of args.slice(start+1)){if(selector(n))break;if(typeof n==='string'&&this.defs.has(n))this.features.add(n);}return 0;}
    const id=this.target(op,ctx);if(typeof id!=='string'){this.diag('unsupported-operation','Unsupported source call was not executed.',ctx.sourceRef,node);return UNKNOWN;}
    if(this.audioStates.has(id))return this.audioCall(id,args,ctx);
    if(id===this.room.instance&&args[0]==='setRegions:'){for(const n of args.slice(1)){if(selector(n))break;const module=this.value(n,ctx);const regions=[...this.defs.values()].filter(d=>d.module===module&&d.base==='Rgn');if(!regions.length)this.diag('unsupported-region','Source region initializer unavailable; no presentation or audio inferred.',ctx.sourceRef,n);for(const r of regions)this.method(r.id,'init',{...ctx,self:r.id,module:this.moduleFor(r.id)});}return 0;}
    if((op==='gFeatures'||id===this.room.instance)&&(args.includes('setFeatures:')||args.includes('add:'))){const start=args.findIndex(v=>v==='setFeatures:'||v==='add:');for(const n of args.slice(start+1)){if(selector(n))break;if(typeof n==='string'&&this.defs.has(n))this.features.add(n);}return 0;}
    const script=this.scripts.get(id);if(script||this.room.scripts.some(s=>s.id===id)||this.defs.get(id)?.base==='Script'){
      if(args[0]==='cue:'){this.cue(id);return 0;}if(args[0]==='dispose:'){this.stopScript(id);return 0;}if(args[0]==='changeState:'||args[0]==='init:'){const n=this.value(args[1],ctx);if(args[0]==='init:')this.startScript(id,ctx.self);else if(finite(n))this.enterState(id,n);return 0;}
    }
    if(id===this.room.instance&&args[0]==='setScript:'){if(typeof args[1]==='string')this.startScript(args[1],id);else if(args[1]===0)for(const s of this.scripts.values())if(s.owner===id)this.stopScript(s.id);return 0;}
    if(!this.actors.has(id)){// Sound/Teller/GUI objects have no rendering state in this VM.
      if(args.includes('init:')||args.includes('play:')||args.includes('stop:')||args.every(n=>selector(n)||scalar(n)))return 0;
      this.diag('unsupported-object','Object call has no presentation implementation.',ctx.sourceRef,node);return UNKNOWN;
    }
    const actor=this.actors.get(id)!;let at=0;while(at<args.length){const sel=args[at++];if(!selector(sel))continue;const a=[];while(at<args.length&&!selector(args[at]))a.push(args[at++]);const v=this.value(a[0],ctx);
      if(sel==='init:'||sel==='addToPic:'){actor.active=true;actor.hidden=false;actor.activation.push(ctx.sourceRef||this.room.sourceRef);this.features.add(id);if(sel==='init:')this.method(id,'init',{...ctx,self:id,module:this.moduleFor(id)});}
      else if(sel==='show:')actor.hidden=false;
      else if(sel==='hide:')actor.hidden=true;
      else if(sel==='dispose:'){actor.active=false;actor.hidden=true;this.motions.delete(id);this.cycles.delete(id);if(actor.script)this.stopScript(actor.script);}
      else if(sel==='posn:'){for(let i=0;i<Math.min(3,a.length);i++){const value=this.value(a[i],ctx);actor[['x','y','z'][i]]=value===UNKNOWN?null:value;}if(id==='gEgo')actor.assignments.push({selector:sel,args:a.map(n=>{const q=this.value(n,ctx);return q===UNKNOWN?{unknown:n}:q;}),sourceRef:ctx.sourceRef});}
      else if(['setLoop:','loop:','setCel:','cel:','setPri:','priority:','view:','x:','y:','z:','cycleSpeed:','moveSpeed:','xStep:','yStep:','scaleX:','scaleY:'].includes(sel)){const key=({'setLoop:':'loop','setCel:':'cel','setPri:':'priority'}as Record<string,string>)[sel]||sel.slice(0,-1);if(v===UNKNOWN){actor.uncertain=true;this.diag('unknown-actor-property','Actor property withheld.',ctx.sourceRef,[id,sel,a[0]]);}else{actor[key]=v;if(key==='cel'&&v===-1)actor.cel=this.frames(actor.view,actor.loop).length-1;if(id==='gEgo')actor.assignments.push({selector:sel,value:v,sourceRef:ctx.sourceRef});}}
      else if(sel==='setScript:'){if(a[0]===0){if(actor.script)this.stopScript(actor.script);}else if(typeof a[0]==='string')this.startScript(a[0],id);}
      else if(sel==='setMotion:'){if(a[0]===0){this.motions.delete(id);actor.mover=0;}else{const x=this.value(a[1],ctx),y=this.value(a[2],ctx),kind=a[0],callback=this.callback(a[3],ctx);if(finite(x)&&finite(y)&&['MoveTo','PolyPath'].includes(kind)){const motion={kind,x,y,callback,elapsed:0,sourceRef:ctx.sourceRef,deferred:kind!=='MoveTo',sequence:++this.motionSequence};this.motions.set(id,motion);actor.mover=1;if(motion.deferred)this.diag('deferred-path','PolyPath movement requires renderer pathfinding; not straight-line simulated.',ctx.sourceRef,[id,x,y]);}else this.diag('unsupported-motion','Unknown or unsupported source mover.',ctx.sourceRef,[id,...a]);}}
      else if(sel==='setCycle:'){if(a[0]===0){this.cycles.delete(id);actor.cycler=0;}else{const kind=a[0],frames=this.frames(actor.view,actor.loop);if(['End','Beg','Fwd','Walk','Rev','CT'].includes(kind)&&frames.length){const direction=kind==='Beg'||kind==='Rev'?-1:kind==='CT'&&finite(this.value(a[2],ctx))?this.value(a[2],ctx):1;const target=kind==='End'?frames.length-1:kind==='Beg'?0:kind==='CT'?this.value(a[1],ctx):undefined;const callback=this.callback(kind==='CT'?a[3]:a[1],ctx);this.cycles.set(id,{kind,direction,target:finite(target)?target:undefined,callback,elapsed:0});actor.cycler=1;}else this.diag('unsupported-cycle','Unknown cycle or unavailable source cel loop.',ctx.sourceRef,[id,...a]);}}
      else if(sel==='setStep:'){const x=this.value(a[0],ctx),y=this.value(a[1],ctx);if(finite(x)&&finite(y)){actor.xStep=x;actor.yStep=y;}}
      else if(sel==='changeState:'&&actor.script&&finite(v))this.enterState(actor.script,v);
      else if(sel==='cue:'&&actor.script)this.cue(actor.script);
      else if(['get:','put:','newRoom:','setStats:','alter:'].includes(sel))this.diag('suppressed-gameplay-write','Native gameplay selector was not executed.',ctx.sourceRef,[id,sel,...a]);
      else if(!ignoredSelectors.has(sel)&&sel!=='super:')this.diag('unsupported-selector','Selector has no presentation implementation.',ctx.sourceRef,[id,sel,...a]);
    }return 0;
  }
  private callback(node:any,ctx:Scope):string|undefined {const id=this.target(node,ctx);return typeof id==='string'&&(this.scripts.has(id)||this.defs.get(id)?.base==='Script')?id:undefined;}
  private audioRecord(id:string,command:string,ctx:Scope,args?:number[]){const a=this.audioStates.get(id)!;const number=(key:string)=>finite(a[key])?a[key]:null;const sequence=++this.audioSequence,event:SourceAudioEvent={sequence,dedupeKey:this.audioSession+':'+sequence,atMs:this.elapsed,objectId:id,command,number:number('number'),loop:number('loop'),volume:number('vol'),priority:number('priority'),sourceRef:ctx.sourceRef,...(args?{arguments:[...args]}:{})};this.audioEvents.push(event);if(this.audioEvents.length>512){this.audioEvents.shift();this.diag('audio-event-window-trimmed','Only latest512 source audio events retained; consume by sequence.',ctx.sourceRef);}a.lastSequence=sequence;a.sourceRef=ctx.sourceRef;}
  private audioCall(id:string,args:any[],ctx:Scope){const sound=this.audioStates.get(id)!;let at=0;while(at<args.length){const sel=args[at++];if(!selector(sel)){this.diag('unsupported-audio-syntax','Audio call contained a non-selector outside its argument list.',ctx.sourceRef,[id,sel]);continue;}const a=[];while(at<args.length&&!selector(args[at]))a.push(args[at++]);const values=a.map(n=>this.value(n,ctx)),value=values[0];
      if(['number:','loop:','setLoop:','vol:','setVol:','priority:','setPri:'].includes(sel)){const key=sel==='number:'?'number':sel==='loop:'||sel==='setLoop:'?'loop':sel==='priority:'||sel==='setPri:'?'priority':'vol',valid=values.length===1&&finite(value)&&Number.isInteger(value)&&(key==='number'?value>=0&&value<=65535:key==='loop'?value>=-1&&value<=32767:key==='vol'?value>=0&&value<=127:value>=0&&value<=255);if(!valid){sound[key]=UNKNOWN;sound.uncertain=true;this.diag(key==='number'?'unknown-audio-number':'unknown-audio-property','Audio property requires a supported known numeric value.',ctx.sourceRef,[id,sel,...a]);continue;}if(sound[key]!==value){sound[key]=value;this.audioRecord(id,key==='vol'?'volume':key,ctx,[value]);}}
      else if(sel==='init:'){sound.signal=0;sound.prevSignal=0;this.audioRecord(id,'init',ctx);}
      else if(sel==='play:'){if(!finite(sound.number)||!Number.isInteger(sound.number)||sound.number<=0||!finite(sound.loop)){sound.uncertain=true;this.diag('unknown-audio-play','Play withheld: source number or loop count is unknown/invalid.',ctx.sourceRef,id);continue;}if(a.length){const volume=values[0];if(finite(volume)&&volume>=0&&volume<=127)sound.vol=volume;else this.diag('audio-callback-unexecuted','Source play caller/callback preserved only as a diagnostic; not acknowledged.',ctx.sourceRef,[id,...a]);}sound.signal=0;sound.prevSignal=0;sound.loop=sound.loop||1;sound.playing=true;sound.paused=false;this.audioRecord(id,'play',ctx);}
      else if(sel==='stop:'||sel==='dispose:'){sound.playing=false;sound.paused=false;this.audioRecord(id,sel.slice(0,-1),ctx);}
      else if(sel==='pause:'||sel==='resume:'){if(sel==='pause:'&&a.length&&(!finite(value)||![0,1].includes(value))){sound.uncertain=true;this.diag('unknown-audio-pause','Pause argument requires known0/1.',ctx.sourceRef,[id,...a]);continue;}const paused=sel==='pause:'?(a.length?!!value:true):false;sound.paused=paused;this.audioRecord(id,paused?'pause':'resume',ctx);}
      else if(sel==='fade:'){const numeric=a.length?values:[0,25,10,1];if(!numeric.every(finite)){sound.uncertain=true;this.diag('unsupported-audio-fade','Fade with unknown parameters/callback was not inferred or acknowledged.',ctx.sourceRef,[id,...a]);}else this.audioRecord(id,'fade',ctx,numeric);}
      else if(['owner:','flags:'].includes(sel)){if(values.length===1)sound[sel.slice(0,-1)]=value;}
      else{this.diag('unsupported-audio-selector','Source sound selector is preserved as unsupported; no callback or playback inferred.',ctx.sourceRef,[id,sel,...a]);}
    }return 0;}
  private frames(view:number,loop:number):any[]{const v=this.assets.views?.[view],l=v?.loops?.[loop];if(!l)return[];const mirrored=l.mirrorOf!==null&&l.mirrorOf!==undefined,source=mirrored?v.loops[l.mirrorOf]:l;return(source?.cels||[]).map((c:any,index:number)=>({...c,index,flipX:mirrored,offsetX:mirrored?-c.x:c.x,offsetY:c.y}));}
  /** Refreshes authoritative read context without replaying init or discarding
   * source-local timers, scripts, motions or audio sequence history. */
  updateNativeState(state:PresentationState):PresentationResult {if(state.room!==this.room.id)throw Error('Presentation VM state update must remain in its source room. Recreate on room transition.');this.state=structuredClone(state);return this.snapshot();}
  /** Explicit native301 service-state handoff. Values0..4 match source locals
   *141/142 (absent,ordered,put-down,consumed,clearing). Validate both before
   * committing; never restarts timers, motions, scripts or audio. Call at native
   * episode/state transitions, not every frame: source comingOut itself advances
   *1→2 before its put-down cycle completes. Reapplying Ordered1 during that cycle
   * would erase actual source progress. This only changes presentation-owned locals. */
  syncInnServiceLocals(value:{meal:number;drink:number}):PresentationResult {
    if(this.room.id!==301)throw Error('Inn service locals belong only to room301.');
    if(!value||Object.keys(value).some(k=>k!=='meal'&&k!=='drink')||![value.meal,value.drink].every(n=>Number.isInteger(n)&&n>=0&&n<=4))throw Error('Inn meal/drink presentation states must both be integers0..4.');
    const locals=this.variables.get('room');if(!locals)throw Error('Room presentation locals are unavailable.');
    locals.set('local141',value.meal);locals.set('local142',value.drink);return this.snapshot();
  }
  /** Starts only an explicit parsed source presentation script. No quest effects. */
  startScript(id:string,owner=this.room.instance,state=0):boolean {if(this.budgetDepth===0)return this.withBudget(()=>this.startScript(id,owner,state));if(!this.defs.get(id)?.methods.some(m=>m.name==='changeState')){this.diag('missing-script','Requested presentation script unavailable.',this.room.sourceRef,id);return false;}const prior=this.actors.get(owner)?.script;if(prior&&prior!==id)this.stopScript(prior);this.scripts.set(id,{id,owner,state,active:true,timer:null,blocked:false,scope:this.moduleFor(id)});const actor=this.actors.get(owner);if(actor)actor.script=id;this.enterState(id,state);return true;}
  private enterState(id:string,n:number){const script=this.scripts.get(id);if(!script?.active)return;script.state=n;script.timer=null;script.blocked=false;this.method(id,'changeState',{self:id,module:script.scope,script:id},[n]);}
  private cue(id:string){const s=this.scripts.get(id);if(s?.active){this.callbacks++;this.enterState(id,s.state+1);}}
  private stopScript(id:string){const s=this.scripts.get(id);if(s){s.active=false;const owner=this.actors.get(s.owner);if(owner?.script===id)owner.script=0;}}
  /** Acknowledges a speech/UI callback explicitly observed by the native caller. */
  acknowledge(id:string):boolean{if(this.budgetDepth===0)return this.withBudget(()=>this.acknowledge(id));const s=this.scripts.get(id);if(s?.active&&s.blocked){s.blocked=false;this.cue(id);return true;}return false;}
  /** Renderer can acknowledge a deferred path after physically reaching its target. */
  completeMotion(id:string):boolean{if(this.budgetDepth===0)return this.withBudget(()=>this.completeMotion(id));const m=this.motions.get(id),p=this.actors.get(id);if(!m||!p)return false;p.x=m.x;p.y=m.y;p.mover=0;this.motions.delete(id);if(m.callback)this.cue(m.callback);return true;}
  /** Advances bounded visual time only; neither game clock nor saves are mutated. */
  advance(dtMs:number,context:{heroPosition?:{x:number;y:number;z?:number}}={}):PresentationResult {
    if(this.budgetDepth===0)return this.withBudget(()=>this.advance(dtMs,context));
    if(!finite(dtMs)||dtMs<0)throw Error('Presentation dt must be finite and nonnegative.');const max=this.options.maxAdvanceMs??30000;if(dtMs>max){this.diag('advance-clamped','Advance duration exceeded bounded visual interval.',this.room.sourceRef,dtMs);dtMs=max;}
    if(context.heroPosition)Object.assign(this.actors.get('gEgo')!,context.heroPosition);
    this.tickRemainder+=dtMs;let ticks=0;while(this.tickRemainder>=1000/60&&ticks++<1801){this.tickRemainder-=1000/60;this.elapsed+=1000/60;
      const due:string[]=[];for(const script of this.scripts.values())if(script.active&&script.timer!==null&&!script.blocked){script.timer-=1000/60;if(script.timer<=.00001){script.timer=null;due.push(script.id);}}for(const id of due)this.cue(id);
      for(const[id,m]of [...this.motions]){const p=this.actors.get(id)!;if(!finite(p.x)||!finite(p.y))continue;if(id==='gEgo'&&context.heroPosition){if(Math.hypot(m.x-p.x,m.y-p.y)<.5)this.completeMotion(id);continue;}if(m.deferred)continue;m.elapsed+=1000/60;const interval=Math.max(1,p.moveSpeed||6)*1000/60;if(m.elapsed+1e-8<interval)continue;m.elapsed-=interval;const dx=m.x-p.x,dy=m.y-p.y,steps=Math.max(Math.abs(dx)/Math.max(1,p.xStep||3),Math.abs(dy)/Math.max(1,p.yStep||2));if(steps<=1)this.completeMotion(id);else{p.x+=dx/steps;p.y+=dy/steps;}}
      for(const[id,c]of [...this.cycles]){const p=this.actors.get(id)!,frames=this.frames(p.view,p.loop);if(!frames.length)continue;c.elapsed+=1000/60;const interval=Math.max(1,p.cycleSpeed||6)*1000/60;if(c.elapsed+1e-8<interval)continue;c.elapsed-=interval;if(c.target!==undefined){if(p.cel!==c.target)p.cel+=Math.sign(c.target-p.cel);if(p.cel===c.target){this.cycles.delete(id);p.cycler=0;if(c.callback)this.cue(c.callback);}}else p.cel=(p.cel+c.direction+frames.length)%frames.length;}
      this.method(this.room.instance,'doit',{self:this.room.instance,module:'room'});
      if(this.budgetSteps>(this.options.maxSteps??120000)){this.tickRemainder=Math.min(this.tickRemainder,1000/60);break;}
    }return this.snapshot();
  }
  snapshot():PresentationResult {
    const drawables:any[]=[],offscreenDrawables:any[]=[],conditionalDrawables:any[]=[],hotspots:any[]=[],actors:Record<string,any>={};
    const rectAt=(p:Actor,c:any)=>{const left=p.x+c.offsetX-Math.floor(c.width/2),bottom=p.y+c.offsetY-(p.z||0)+1;return{left,top:bottom-c.height,right:left+c.width,bottom};};
    for(const e of this.room.entities){const p=this.actors.get(e.id)!;const portrait=['Talker','Teller'].includes(e.base||'')||/Bust|Mouth|Talker/i.test(e.id);const frames=this.frames(p.view,p.loop),cel=finite(p.cel)?Math.max(0,Math.min(frames.length-1,p.cel)):0,frame=frames[cel];let rect=frame&&finite(p.x)&&finite(p.y)?rectAt(p,frame):undefined;if(!rect&&['nsLeft','nsTop','nsRight','nsBottom'].every(k=>finite(p[k])))rect={left:p.nsLeft,top:p.nsTop,right:p.nsRight,bottom:p.nsBottom};const onscreen=!!rect&&rect.right>0&&rect.left<320&&rect.bottom>0&&rect.top<190,active=p.active&&!p.hidden&&!p.uncertain&&!portrait;actors[e.id]={active:p.active,hidden:p.hidden,uncertain:p.uncertain,onscreen,x:p.x,y:p.y,z:p.z,view:p.view,loop:p.loop,cel,script:p.script||null};
      if(frame&&rect&&!portrait){const d={entityId:e.id,name:e.name||e.id,noun:p.noun??null,view:p.view,loop:p.loop,cel,x:p.x,y:p.y,z:p.z,priority:p.priority,animated:this.cycles.has(e.id),cycleSpeed:p.cycleSpeed,sourceRef:e.sourceRef,activation:[...p.activation],visibility:active&&onscreen?'known':'withheld',poseConfidence:p.poseUncertain?'last-known-before-unknown-branch':'known',conditional:p.conditional,frame:{...frame,rect},frames:frames.map(c=>({...c,rect:rectAt(p,c)})),rect,scaleX:p.scaleX,scaleY:p.scaleY,motion:this.motions.has(e.id)?{...this.motions.get(e.id)}:null};if(active&&onscreen)drawables.push(d);else if(active)offscreenDrawables.push(d);else if(p.uncertain)conditionalDrawables.push(d);}
      if(rect&&onscreen&&(active||this.features.has(e.id))&&!portrait&&!p.uncertain)hotspots.push({entityId:e.id,name:e.name||e.id,noun:p.noun??null,rect,sourceRef:e.sourceRef,drawable:active&&onscreen});
    }
    const p=this.actors.get('gEgo')!,positionKnown=finite(p.x)&&finite(p.y)&&!p.uncertain,m=this.motions.get('gEgo');const hero={x:finite(p.x)?p.x:null,y:finite(p.y)?p.y:null,z:p.z,view:p.view,loop:p.loop,cel:p.cel,hidden:p.hidden,initialized:p.active,positionKnown,previousRoom:this.state.previousRoom??0,night:!!(this.state.minutes>=1200||this.state.minutes<300),entryEdge:p.edgeHit===UNKNOWN?null:p.edgeHit,assignments:structuredClone(p.assignments),motion:m?{type:m.kind,x:m.x,y:m.y,deferred:m.deferred,sourceRef:m.sourceRef}:null,sourceRef:p.assignments.at(-1)?.sourceRef||this.room.sourceRef,confidence:positionKnown?'explicit-source-presentation':'unresolved'};
    return{room:this.room.id,drawables,offscreenDrawables,conditionalDrawables,hotspots,hero,actors,audioSession:this.audioSession,audioEvents:this.audioEvents.map(e=>({...e,arguments:e.arguments?[...e.arguments]:undefined})),audioRequests:this.audioEvents.filter(e=>['play','stop','pause','resume','fade','dispose'].includes(e.command)).map(e=>({...e,arguments:e.arguments?[...e.arguments]:undefined})),audioState:Object.fromEntries([...this.audioStates].map(([id,s])=>[id,Object.fromEntries(['number','loop','vol','priority','signal','prevSignal','playing','paused','uncertain','lastSequence','sourceRef'].map(k=>[k,s[k]===UNKNOWN?null:s[k]]))])),motions:Object.fromEntries([...this.motions].map(([id,m])=>{const p=this.actors.get(id)!;return[id,{kind:m.kind,x:m.x,y:m.y,deferred:m.deferred,sequence:m.sequence,sourceRef:m.sourceRef,moveSpeed:p.moveSpeed,xStep:p.xStep,yStep:p.yStep}];})),scripts:[...this.scripts.values()].map(s=>({id:s.id,owner:s.owner,state:s.state,active:s.active,blocked:s.blocked,timerMs:s.timer,sourceRef:this.defs.get(s.id)?.sourceRef})),diagnostics:[...this.diagnosticMap.values()].map(d=>({...d})),coverage:{knownDrawables:drawables.length,withheldDrawables:conditionalDrawables.length,steps:this.steps,timedCallbacks:this.callbacks,complete:false}};
  }
}
export function createPresentationVM(room:SourceRoom,state:PresentationState,sourceFlags:Record<string,Condition|boolean|number>,assetManifest:any,options:PresentationOptions={}):PresentationVM {return new PresentationVM(room,state,sourceFlags,assetManifest,options);}
export function projectRoom(room:SourceRoom,state:PresentationState,sourceFlags:Record<string,Condition|boolean|number>,assetManifest:any,options:PresentationOptions={}):PresentationResult {return createPresentationVM(room,state,sourceFlags,assetManifest,options).snapshot();}
/** Physical source-projection checkpoint, not native quest completion. Root
 * must additionally match the currently ordered service serial. State7 on a
 * greeting/return-to-kitchen leg is deliberately insufficient. */
export function innDeliveryProjected(p:PresentationResult,kind:'meal'|'coffee'):boolean {
  if(p.room!==301||(kind!=='meal'&&kind!=='coffee'))return false;
  const script=p.scripts.find(s=>s.id==='comingOut'&&s.owner==='shema'&&s.active&&(s.state===5||s.state===6)),shema=p.actors.shema,item=p.actors[kind==='meal'?'Food':'Drink'];
  return !!script&&!p.motions.shema&&[shema,item].every(a=>a?.active&&!a.hidden&&!a.uncertain&&a.onscreen);
}
