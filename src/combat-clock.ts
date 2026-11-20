/** Browser-only live cadence for the source-informed Brigand phases.
 * This is a timed native adapter, not an SCI interpreter. No wall timestamps,
 * background simulation, catch-up loops, or automatic hero attacks. */
import {act,combatEnemyBeat,combatStatus,resolveCombatSpell,type Action,type Campaign,type CombatClockState,type GameState} from './rules';

export type CombatClock=CombatClockState;
export interface CombatClockOptions {active:boolean;}
export interface CombatClockUI {mode:'live'|'turn'|'none';playerReady:boolean;playerInMs:number;enemyInMs:number;defenseInMs:number;status:string;}
export interface CombatClockResult {state:GameState;clock:CombatClock|null;events:string[];accepted:boolean;reason?:string;ui:CombatClockUI;}
export const LIVE_COMBAT_MAX_FRAME_MS=100;
const tickMs=1000/60;
/** Source anchors: brigandArena142-207, closeCombat657-1119/1144-1260,
 * Motion8-125, original view467(4/3/3/4cels),109(8),102(6),111(3),112(4).
 * Cycle begins with an immediate step; callback/engine-loop quantization and
 * simultaneous source animation are not modeled by these nominal durations. */
export const BRIGAND_TIMING=Object.freeze({
  decisionTicks:18,attackAnimationTicks:44,hitRecoveryTicks:30,missRecoveryTicks:18,
  swordHitTicks:48,swordMissTicks:55,daggerHitTicks:32,daggerMissTicks:39,
  shieldBlockTicks:21,daggerBlockTicks:29,dodgeTicks:28,
  zapTicks:33,dazzleCastTicks:65,flameCastTicks:60,
  heroHurtTicks:44,
});
const copy=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
export function supportsLiveCombat(s:GameState):boolean{return !s.dead&&s.combat?.id==='brigand'&&!!s.combat.sourceStats;}
const phase=(s:GameState):CombatClock['phase']=>s.combat?.dazzleTicks?'dazzled':s.combat?.intent||'idle';
function duration(s:GameState,p=phase(s)):number{
  const e=s.combat;
  if(p==='dazzled')return Math.max(1,e?.dazzleTicks||1)*tickMs;
  if(p==='windup')return BRIGAND_TIMING.decisionTicks*tickMs;
  if(p==='recover')return (BRIGAND_TIMING.attackAnimationTicks+BRIGAND_TIMING.missRecoveryTicks)*tickMs;
  return (e?.poseTicks??(p==='guard'?44:1))*tickMs;
}
export function combatClockUI(s:GameState,k:CombatClock|null):CombatClockUI{
  return {mode:supportsLiveCombat(s)?'live':s.combat?'turn':'none',playerReady:!k||k.playerInMs<=0,playerInMs:k?.playerInMs||0,enemyInMs:k?.enemyInMs||0,defenseInMs:k?.defenseInMs||0,status:combatStatus(s)};
}
function validClock(s:GameState,k:any):k is CombatClock{
  const p=k?.pendingSpell,pendingValid=p===undefined||!!p&&['dazzleSpell','flameDartSpell'].includes(p.id)&&Number.isInteger(p.power)&&p.power>=1&&p.power<=10000&&Number.isFinite(p.remainingMs)&&p.remainingMs>=0&&p.remainingMs<=60000&&p.remainingMs<=k.playerInMs;
  return !!k&&pendingValid&&k.version===1&&k.enemyId===s.combat?.id&&k.room===s.room&&typeof k.paused==='boolean'&&['normal','attack','parry','dodge'].includes(k.defense)&&['guard','idle','windup','recover','dazzled'].includes(k.phase)&&['elapsedMs','enemyInMs','playerInMs','defenseInMs'].every(f=>typeof k[f]==='number'&&Number.isFinite(k[f])&&k[f]>=0)&&['enemyInMs','playerInMs','defenseInMs'].every(f=>k[f]<=60000);
}
/** Resumes saved simulation durations. Loading does not account for elapsed
 * real-world time. A legacy turn save starts a fresh, unadvanced phase. */
export function createCombatClock(s:GameState):CombatClock{
  if(!supportsLiveCombat(s))throw Error('Live cadence is currently supported only for the source-informed Brigand.');
  if(s.combat?.clock){if(!validClock(s,s.combat.clock))throw Error('Invalid saved live combat clock');return {...copy(s.combat.clock),paused:true};}
  return {version:1,enemyId:s.combat!.id,room:s.room,elapsedMs:0,enemyInMs:duration(s),playerInMs:0,defenseInMs:0,defense:'normal',phase:phase(s),paused:true};
}
function finish(s:GameState,k:CombatClock|null,events:string[]=[],accepted=false,reason?:string):CombatClockResult{
  const state=copy(s),clock=supportsLiveCombat(state)&&k?copy(k):null;
  if(state.combat){if(clock)state.combat.clock=copy(clock);else delete state.combat.clock;}
  return {state,clock,events,accepted,...(reason?{reason}:{}),ui:combatClockUI(state,clock)};
}
function check(s:GameState,k:CombatClock){if(!validClock(s,k))throw Error('Combat clock does not match this encounter.');}
function playerDuration(s:GameState,a:Action,hit:boolean):number{
  const t=BRIGAND_TIMING,sword=!!s.inventory.sword;
  if(a.type==='attack')return (sword?(hit?t.swordHitTicks:t.swordMissTicks):(hit?t.daggerHitTicks:t.daggerMissTicks))*tickMs;
  if(a.type==='parry')return (sword?t.shieldBlockTicks:t.daggerBlockTicks)*tickMs;
  if(a.type==='dodge')return t.dodgeTicks*tickMs;
  if(a.type==='cast')return (a.spell==='zapSpell'?t.zapTicks:a.spell==='dazzleSpell'?t.dazzleCastTicks:t.flameCastTicks)*tickMs;
  // Consumables/escape retain the earlier native conveniences; they are not
  // presented as original combat-inventory timing.
  return 0;
}
/** Player input never advances the enemy clock. Original stat formulas and
 * phase probabilities remain in rules; only ownership of their cadence changes. */
export function combatInput(s:GameState,clock:CombatClock,a:Action,c:Campaign,options:CombatClockOptions):CombatClockResult{
  if(!supportsLiveCombat(s)){const result=act(s,a,c);return finish(result.state,null,result.events,true);}
  check(s,clock);const k=copy(clock);
  if(!options.active){k.paused=true;return finish(s,k,[],false,'Combat is paused.');}
  k.paused=false;
  if(a.type==='wait')return finish(s,k,[],true);
  // Escape stays available during one's own animation as a deliberate modern
  // convenience; the reducer still enforces original no-escape locations.
  if(k.playerInMs>0&&a.type!=='flee')return finish(s,k,[],false,'Your current action is still recovering.');
  if(!['attack','parry','dodge','cast','flee','eat','drink'].includes(a.type))return finish(s,k,[],false,'Finish the combat first.');
  if(a.type==='cast'&&(!s.spells.includes(a.spell||'')||s.stats.mana<(c.spells.find(x=>x.id===a.spell)?.cost??Infinity))){const rejected=act(s,a,c,{combatCadence:'clock'});return finish(s,k,rejected.events,false);}
  if(['eat','drink'].includes(a.type)&&!(s.inventory[a.item||(a.type==='eat'?'rations':'healingPotion')]>0)){const rejected=act(s,a,c,{combatCadence:'clock'});return finish(s,k,rejected.events,false);}
  const result=act(s,a,c,{combatCadence:'clock',deferCastEffect:true});
  if(a.type==='flee'&&result.state.combat)return finish(s,k,result.events,false,'You cannot escape this encounter.');
  if(!supportsLiveCombat(result.state))return finish(result.state,null,result.events,true);
  const interrupted=!!result.combatEffect?.interrupted,hit=!!result.combatEffect?.hit;
  k.playerInMs=playerDuration(s,a,hit);k.defense=a.type==='parry'?'parry':a.type==='dodge'?'dodge':a.type==='attack'?'attack':'normal';k.defenseInMs=k.playerInMs;
  if(result.combatEffect?.pendingSpell)k.pendingSpell={...result.combatEffect.pendingSpell,remainingMs:k.playerInMs};
  if(interrupted){k.phase=phase(result.state);k.enemyInMs=k.playerInMs+BRIGAND_TIMING.decisionTicks*tickMs;}
  else if(phase(result.state)!==k.phase){k.phase=phase(result.state);k.enemyInMs=duration(result.state,k.phase);}
  return finish(result.state,k,result.events,true);
}
/** One bounded active frame. First frame after resuming discards dt. Excess
 * frame duration and overdue remainder are discarded, never replayed in a burst. */
export function advanceCombatClock(s:GameState,clock:CombatClock,dtMs:number,_campaign:Campaign,options:CombatClockOptions):CombatClockResult{
  if(!Number.isFinite(dtMs)||dtMs<0)throw Error('Invalid combat frame duration.');
  if(!supportsLiveCombat(s))return finish(s,null);
  check(s,clock);const k=copy(clock);
  if(!options.active){k.paused=true;return finish(s,k);}
  if(k.paused){k.paused=false;return finish(s,k);}
  const dt=Math.min(dtMs,LIVE_COMBAT_MAX_FRAME_MS);k.elapsedMs+=dt;k.playerInMs=Math.max(0,k.playerInMs-dt);k.defenseInMs=Math.max(0,k.defenseInMs-dt);if(k.defenseInMs===0)k.defense='normal';
  k.enemyInMs=Math.max(0,k.enemyInMs-dt);let state=s;const events:string[]=[];let completedCast=false;
  if(k.pendingSpell){k.pendingSpell.remainingMs=Math.max(0,k.pendingSpell.remainingMs-dt);if(k.pendingSpell.remainingMs===0){
    // Simultaneous deadlines resolve the already-started player cast first.
    // This is an explicit native ordering, not original scheduler parity.
    const resolved=resolveCombatSpell(state,k.pendingSpell);state=resolved.state;events.push(...resolved.events);delete k.pendingSpell;completedCast=true;
    if(!supportsLiveCombat(state))return finish(state,null,events,true);
    k.phase=phase(state);k.enemyInMs=duration(state,k.phase);
  }}
  if(k.phase==='dazzled'){state=copy(state);state.combat!.dazzleTicks=Math.ceil(k.enemyInMs/tickMs);}
  if(k.enemyInMs>0)return finish(state,k,events,completedCast);
  const previous=k.phase,hp=state.stats.health,result=combatEnemyBeat(state,k.defense);state=result.state;
  events.push(...result.events);if(!supportsLiveCombat(state))return finish(state,null,events,true);
  // painReaction.sc:40-91 locks normal input through1+8+5+30ticks;
  // the short End callback and logic-loop rounding remain nominal here.
  if(state.stats.health<hp){if(k.pendingSpell){delete k.pendingSpell;events.push('The blow interrupts your unfinished spell.');}k.playerInMs=BRIGAND_TIMING.heroHurtTicks*tickMs;k.defense='normal';k.defenseInMs=0;}
  k.phase=phase(state);
  if(previous==='windup')k.enemyInMs=(BRIGAND_TIMING.attackAnimationTicks+(state.stats.health<hp?BRIGAND_TIMING.hitRecoveryTicks:BRIGAND_TIMING.missRecoveryTicks))*tickMs;
  else{k.enemyInMs=duration(state,k.phase);if((previous==='guard'||previous==='idle')&&(k.phase==='guard'||k.phase==='idle'))k.enemyInMs+=BRIGAND_TIMING.decisionTicks*tickMs;}
  return finish(state,k,events,true);
}
