/** Bounded projection of VGA rm300.sEnter. Not a general SCI interpreter.
 * The caller owns new-game/pending/completed markers and animation playback.
 * No save, score, clock, or quest state is mutated here. */
import type {SourceRoom,PresentationSpeech} from './presentation-vm';
type Procedure={name:string;sourceRef:string;ast:any[]};
type Line=PresentationSpeech['lines'][number];
export type TownOpeningStep=
 |{type:'walk';x:number;y:number;sourceState:number;sourceRef:string}
 |{type:'heading';heading:number;sourceState:number;sourceRef:string}
 |{type:'delay';ticks:number;sourceState:number;sourceRef:string}
 |{type:'speech';lines:Line[];sourceState:number;sourceRef:string;callback:boolean};
export interface TownOpeningPlan {
 id:'vga-town-opening';room:300;start:{x:number;y:number};steps:TownOpeningStep[];
 sourceClock:{minutes:number;day:number;onlyWhenSourceFlag88Clear:true};
 score:{puzzle:number;points:number};sourceRefs:string[];
 /** These are source conditions, not permission to replay on loaded saves. */
 conditions:{script:'sEnter';welcomeSkippedFrom:number;nightAlternative:'climbIn';visitedFlag:88};
}
function need(ok:any,message:string):asserts ok{if(!ok)throw new Error('Unsupported VGA opening source: '+message);}
const same=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
function find(ast:any,test:(a:any[])=>boolean):any[]|undefined{if(!Array.isArray(ast))return; if(test(ast))return ast;for(const a of ast){const x=find(a,test);if(x)return x;}}
/** Extracts literal source positions, delays, clock reset, and exact messages.
 * Intentionally refuses changed/unknown forms instead of manufacturing a scene.
 * Fresh creation uses the daytime branch: rm300.init itself calls FixTime11.
 */
export function projectTownOpening(room:SourceRoom,assets:any,procedures:Procedure[]):TownOpeningPlan{
 need(room.id===300,'expected room300');
 const init=room.methods.find(m=>m.name==='init'),method=room.scripts.find(s=>s.id==='sEnter')?.methods.find(m=>m.name==='changeState');
 need(init&&method,'missing init/sEnter.changeState');
 const sw=find(method.ast,a=>a[0]==='switch'&&same(a[1],['=','state','newState']));need(sw,'missing state switch');
 const state=(n:number)=>{const x=sw.slice(2).find(a=>Array.isArray(a)&&a[0]===n);need(x,'missing state'+n);return x as any[];};
 const ref=method.sourceRef;
 const starts=find(init.ast,a=>a[0]==='switch'&&a[1]==='gPrevRoomNum');need(starts,'missing previous-room switch');
 const fallback=starts.find(a=>Array.isArray(a)&&a[0]==='else');need(fallback,'missing default gate entry');
 const pos=find(fallback,a=>a[0]==='gEgo'&&a[1]==='posn:');need(pos&&pos.length===4&&pos.slice(2).every(Number.isFinite),'nonliteral entry position');
 need(!!find(fallback,a=>same(a,['gCurRoom','setScript:','sEnter'])),'default entry is not sEnter');
 const fresh=find(init.ast,a=>a[0]==='if'&&same(a[1],['not',['IsFlag',88]]));need(fresh,'missing fresh visit reset');
 const clock=find(fresh,a=>a[0]==='FixTime'),day=find(fresh,a=>a[0]==='='&&a[1]==='gDay');need(clock&&clock.length===2&&Number.isFinite(clock[1])&&day&&Number.isFinite(day[2]),'unknown clock reset');
 need(!!find(state(0),a=>same(a,['gCurRoom','setScript:','climbIn'])),'night branch changed');
 need(!!find(state(5),a=>same(a,['==','gPrevRoomNum',65])),'return gate branch changed');
 need(!!find(state(9),a=>same(a,['HandsOn']))&&!!find(state(9),a=>same(a,['self','dispose:'])),'completion control changed');
 const rows=assets.messages?.[300];need(Array.isArray(rows),'missing room message resource');
 function speech(call:any[],sourceState:number,sourceRef:string):TownOpeningStep{
  need(call[0]==='gMessager'&&call[1]==='say:','unknown speech call');
  const [noun,verb=0,condition=0,seq=0,callback]=call.slice(2);need([noun,verb,condition,seq].every(Number.isFinite),'nonliteral message tuple');
  const lines:Line[]=[];for(let sequence=seq||1;;sequence++){const row=rows.find((r:any)=>r.noun===noun&&r.verb===verb&&r.condition===condition&&r.sequence===sequence);if(!row)break;lines.push({text:row.text,talker:row.talker,source:{module:300,noun,verb,condition,sequence}});if(seq)break;}
  need(lines.length,'unresolved source messages');return{type:'speech',lines,sourceState,sourceRef,callback:callback==='self'};
 }
 const steps:TownOpeningStep[]=[];
 function walk(n:number){const a=find(state(n),a=>a[0]==='gEgo'&&a[1]==='setMotion:');need(a&&a[2]==='MoveTo'&&a.slice(3,5).every(Number.isFinite)&&a[5]==='self','unknown walk');steps.push({type:'walk',x:a[3],y:a[4],sourceState:n,sourceRef:ref});}
 function heading(n:number){const a=find(state(n),a=>a[0]==='gEgo'&&a[1]==='setHeading:');need(a&&Number.isFinite(a[2]),'unknown heading');steps.push({type:'heading',heading:a[2],sourceState:n,sourceRef:ref});}
 function delay(n:number){const a=find(state(n),a=>a[0]==='='&&a[1]==='ticks');need(a&&Number.isFinite(a[2]),'unknown timer');steps.push({type:'delay',ticks:a[2],sourceState:n,sourceRef:ref});}
 walk(1);for(const n of[2,3,4]){heading(n);delay(n);}
 const proc=procedures.find(p=>p.name==='localproc_0');need(proc,'missing town description procedure');
 const daytime=find(proc.ast,a=>a[0]==='if'&&same(a[1],['<','gTimeOfDay',4]));need(daytime&&Array.isArray(daytime[2]),'unknown daytime description condition');
 steps.push(speech(daytime[2],5,proc.sourceRef));delay(5);walk(6);heading(7);
 const greeting=find(state(8),a=>a[0]==='gMessager'&&a[1]==='say:');need(greeting,'missing welcome');steps.push(speech(greeting,8,ref));
 const score=find(state(1),a=>a[0]==='SolvePuzzle');need(score&&score.slice(1).length===2&&score.slice(1).every(Number.isFinite),'unknown arrival score');
 return{id:'vga-town-opening',room:300,start:{x:pos[2],y:pos[3]},steps,sourceClock:{minutes:clock[1]*60,day:day[2],onlyWhenSourceFlag88Clear:true},score:{puzzle:score[1],points:score[2]},sourceRefs:[init.sourceRef,method.sourceRef,proc.sourceRef],conditions:{script:'sEnter',welcomeSkippedFrom:65,nightAlternative:'climbIn',visitedFlag:88}};
}
