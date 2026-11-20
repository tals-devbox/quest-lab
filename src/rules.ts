/** Native Quest Lab rules. Puzzle chains are source-backed adaptations, not an SCI VM. */
export type HeroClass = 'fighter' | 'magic-user' | 'thief';
export type Stats = Record<string, number>;
export interface SourceCombatStats {strength:number; intelligence:number; agility:number; vitality:number; luck:number; weaponUse:number; parry:number; dodge:number; armorValue:number; armorEnc:number; shieldValue:number; weaponValue:number;}
export interface PendingCombatSpell {id:'dazzleSpell'|'flameDartSpell';power:number;}
export interface CombatClockState {version:1;enemyId:string;room:number;elapsedMs:number;enemyInMs:number;playerInMs:number;defenseInMs:number;defense:'normal'|'attack'|'parry'|'dodge';phase:'guard'|'idle'|'windup'|'recover'|'dazzled';paused:boolean;pendingSpell?:(PendingCombatSpell&{remainingMs:number});}
export interface CombatState { id:string; name:string; health:number; maxHealth:number; power:number; defense:number; reward:number; defeatedFlag?:string; returnRoom:number; round:number; sourceStats?:SourceCombatStats; stamina?:number; randomEncounter?:boolean; arena?:number; canFlee?:boolean; intent?:'guard'|'idle'|'windup'|'recover'|'dazzled'; dazzleTicks?:number; heroStamina?:number; poseTicks?:number;clock?:CombatClockState; }
export interface GameState {
  version:number; heroName:string; heroClass:HeroClass; room:number; stats:Stats;
  inventory:Record<string,number>; flags:Record<string,boolean>; quests:Record<string,string>;
  minutes:number; day:number; gold:number; silver:number; score:number; combat:CombatState|null;
  dead:boolean; won:boolean; journal:string[]; revision:number; seed:number; spells:string[];
  droppedItems?:{room:number;items:Record<string,number>};
  loot?:{id:string;name:string;silver:number;arena?:number};
  minigame?: {kind:'maze'|'darts'; active:boolean; round:number; player:number; opponent:number; wager?:number; force?:number; angle?:number; handX?:number; handY?:number; obstacles?:{id:string;kind:string;x:number;y:number;cleared:boolean}[];};
}
export interface Action { type:string; target?:string; item?:string; spell?:string; to?:number; topic?:string; amount?:number; label?:string; }
export interface ActOptions {combatCadence?:'turn'|'clock';deferCastEffect?:boolean;}
export interface ActionResult {state:GameState;events:string[];matchedRuleIds?:string[];combatEffect?:{hit:boolean;interrupted:boolean;pendingSpell?:PendingCombatSpell};}
export interface Condition { flag?:string; notFlag?:string; item?:string; count?:number; skill?:string; min?:number; silver?:number; heroClass?:HeroClass; night?:boolean; minuteMin?:number; minuteMax?:number; dayFlag?:string; spell?:string; stat?:string; equals?:number; all?:Condition[]; any?:Condition[]; not?:Condition; }
export interface Effect { item?:string; amount?:number; flag?:string; value?:boolean; quest?:string; stage?:string; score?:number; silver?:number; gold?:number; room?:number; learn?:string; skill?:string; increase?:number; combat?:string; heal?:number; win?:boolean; dayFlag?:string; stat?:string; set?:number; sleep?:boolean; }
export interface Rule { id:string; room:number|number[]; action:Action; label?:string; requires?:Condition; unless?:Condition; effects:Effect[]; text:string; blocked?:string; once?:boolean; minutes?:number; sourceRefs?:string[]; }
export interface Room { id:number; name:string; description?:string; exits:number[]; actions?:Action[]; sourceRefs?:string[]; coverage?:string; encChance?:number; }
export interface Item { id:string; name:string; description?:string; weight?:number; }
export interface Spell { id:string; name:string; cost:number; description?:string; }
export interface Encounter { id:string; name:string; health:number; power:number; defense:number; reward:number; defeatedFlag?:string; sourceStats?:SourceCombatStats; arena?:number; sourceRefs?:string[]; }
export interface Shop {room:number;merchant?:{id:string;name:string;aliases:string[]};when?:Condition;closedText?:string;sourceRefs?:string[];items:{item:string;price:number;count?:number}[];}
export interface CommerceOption {room:number;merchantId:string;merchantName:string;item:string;name:string;count:number;price:number;currency:'silver';action:Action;enabled:boolean;reason?:string;sourceRefs:string[];}
export interface Campaign {
  version:number; title:string; fidelity?:{status:string; limitations:string[]}; rooms:Room[]; items:Item[];
  spells:Spell[]; rules:Rule[]; quests:{id:string; title:string; description:string}[];
  shops:Shop[];
  encounters:Encounter[]; gates?:{from:number; to:number; requires:Condition; blocked:string}[];
  wilderness?:{byRoll:number[]; fallback:number; species:{arena:number;enemy:string;lootMin:number;lootMax:number}[];brigandRooms:number[];sourceRefs:string[]};
}
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
function recalculate(s:GameState,fill=false){
  const h=2*Math.floor((s.stats.strength+2*s.stats.vitality)/3),st=2*(s.stats.agility+s.stats.vitality),m=s.stats.magic?Math.floor((s.stats.intelligence+2*s.stats.magic)/3):0;
  s.stats.health=fill?h:clamp(s.stats.health+h-s.stats.maxHealth,0,h);s.stats.stamina=fill?st:clamp(s.stats.stamina+st-s.stats.maxStamina,0,st);s.stats.mana=fill?m:clamp(s.stats.mana+m-s.stats.maxMana,0,m);
  s.stats.maxHealth=h;s.stats.maxStamina=st;s.stats.maxMana=m;
}
export const isNight=(s:GameState)=>s.minutes>=1200||s.minutes<300;
export function createGame(heroName:string,heroClass:HeroClass='fighter'):GameState {
  const cls:HeroClass=['fighter','magic-user','thief'].includes(heroClass)?heroClass:'fighter';
  const stats:Stats={strength:25,agility:15,vitality:15,intelligence:10,luck:10,weaponUse:20,parry:15,dodge:10,stealth:0,climbing:0,throwing:10,pickLocks:0,magic:0,health:0,maxHealth:0,stamina:0,maxStamina:0,mana:0,maxMana:0,hunger:0,unspent:50};
  if(cls==='magic-user')Object.assign(stats,{strength:10,intelligence:25,magic:25,weaponUse:10,parry:0,dodge:15,throwing:0});
  if(cls==='thief')Object.assign(stats,{strength:10,intelligence:15,agility:25,vitality:10,weaponUse:10,parry:0,dodge:5,stealth:10,pickLocks:10,throwing:5,climbing:5});
  const s:GameState={version:1,heroName:heroName.trim().slice(0,48)||'Hero',heroClass:cls,room:300,stats,
    inventory:{rations:5,leather:1,...(cls==='fighter'?{sword:1,shield:1}:{dagger:1}),...(cls==='thief'?{lockPick:1}:{})},
    flags:{},quests:{hero:'Explore Spielburg and learn who needs help.'},minutes:480,day:1,gold:4,silver:10,score:0,combat:null,dead:false,won:false,journal:['You arrive at Spielburg seeking adventure. Visit the Adventurer’s Guild to learn about the missing children and the brigands.'],revision:0,seed:1234567,
    spells:cls==='magic-user'?['zapSpell']:[]};if(cls==='magic-user')s.stats['spell:zapSpell']=10;recalculate(s,true);return s;
}
export function meets(s:GameState,c?:Condition):boolean {
  if(!c)return true;
  if(c.all&&!c.all.every(x=>meets(s,x)))return false;
  if(c.any&&!c.any.some(x=>meets(s,x)))return false;
  if(c.not&&meets(s,c.not))return false;
  if(c.flag&&!s.flags[c.flag])return false;
  if(c.notFlag&&s.flags[c.notFlag])return false;
  if(c.item&&(s.inventory[c.item]||0)<(c.count||1))return false;
  if(c.skill&&(s.stats[c.skill]||0)<(c.min||1))return false;
  if(c.silver!==undefined&&s.silver+s.gold*10<c.silver)return false;
  if(c.dayFlag&&s.stats['day:'+c.dayFlag]===s.day)return false;
  if(c.spell&&!s.spells.includes(c.spell))return false;
  if(c.stat&&(s.stats[c.stat]||0)!==c.equals)return false;
  if(c.heroClass&&s.heroClass!==c.heroClass)return false;
  if(c.night!==undefined&&isNight(s)!==c.night)return false;
  if(c.minuteMin!==undefined&&s.minutes<c.minuteMin)return false;
  if(c.minuteMax!==undefined&&s.minutes>c.minuteMax)return false;
  return true;
}
function matches(a:Action,b:Action):boolean {
  return a.type===b.type&&(['target','item','spell','topic','to'] as const).every(k=>b[k]===undefined||a[k]===b[k]);
}
function inRoom(s:GameState,r:Rule){return Array.isArray(r.room)?r.room.includes(s.room):r.room===s.room;}
function active(s:GameState,r:Rule){return inRoom(s,r)&&!(r.once!==false&&s.flags['rule:'+r.id])&&!(r.unless&&meets(s,r.unless));}
function random(s:GameState){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
const roll=(s:GameState,min:number,max:number)=>min+Math.floor(random(s)*(max-min+1));
function skillUsed(s:GameState,skill:string,amount:number){
  if(!s.stats[skill])return;
  amount=Math.min(Math.abs(Math.floor(amount)),s.stats[skill]);
  s.stats.experience=(s.stats.experience||0)+Math.floor(amount/4);
  const key='practice:'+skill;s.stats[key]=(s.stats[key]||0)+amount;
  if(s.stats[key]>=s.stats[skill]){s.stats[key]-=s.stats[skill];s.stats[skill]=Math.min(100,s.stats[skill]+roll(s,1,3));recalculate(s);}
}
function trySkill(s:GameState,skill:string,difficulty=0,bonus=0){
  let level=s.stats[skill]||0;if(!level)return false;level+=bonus;
  const test=difficulty||roll(s,1,100);
  if(skill==='stealth')s.stats.stamina=Math.max(0,s.stats.stamina-(difficulty?Math.floor(difficulty/10):roll(s,1,6)));
  if(s.stats.luck>=roll(s,1,200))level+=roll(s,1,20);
  const gap=Math.abs(test-level),divisor=gap<=10?2:gap<=30?4:gap<=50?6:0;
  if(divisor){const amount=['stealth','parry','dodge'].includes(skill)?Math.floor((s.stats.agility*3+s.stats.intelligence)/8):skill==='weaponUse'?Math.floor((s.stats.agility*2+s.stats.strength*2)/16):skill.startsWith('spell:')?Math.floor((s.stats.magic*4+s.stats.intelligence*2)/6):10;skillUsed(s,skill,Math.floor(amount/divisor));}
  return test<=level;
}
function log(s:GameState,events:string[],message:string){events.push(message);s.journal.push(message);if(s.journal.length>200)s.journal=s.journal.slice(-200);}
function time(s:GameState,minutes:number,events:string[]){
  const before=Math.floor(s.minutes/60);s.minutes+=minutes;while(s.minutes>=1440){s.minutes-=1440;s.day++;}
  const hours=Math.floor(s.minutes/60)-before+(s.minutes<before*60?24:0);
  s.stats.hunger=clamp(s.stats.hunger+Math.max(0,hours)*3,0,100);
  if(s.stats.hunger>=85){s.stats.health=Math.max(0,s.stats.health-2*Math.max(hours,0));if(hours>0)events.push('Hunger is weakening you. Eat a ration.');}
  if(s.flags.babaDeadline&&s.day>(s.stats.babaDeadlineDay||999)&&!s.flags.mandrakeDelivered){s.stats.health=0;log(s,events,'Baba Yaga’s curse takes effect. Your adventure ends as a frog. Restore a save and retrieve her mandrake in time.');}
  if(s.stats.health<=0){s.dead=true;events.push('Your adventure has ended. Restore a saved game to try another approach.');}
  if(s.room===70&&isNight(s)){s.room=170;s.flags['visited:170']=true;}else if(s.room===170&&!isNight(s)){s.room=70;s.flags['visited:70']=true;}
}
function beginCombat(s:GameState,id:string,c:Campaign,events:string[]){
  const e=c.encounters.find(x=>x.id===id);if(!e){events.push('This encounter has not been configured.');return;}
  if(e.defeatedFlag&&s.flags[e.defeatedFlag]){events.push('That opponent has already been defeated.');return;}
  const units=c.items.reduce((total,item)=>total+(s.inventory[item.id]||0)*(item.weight||0),s.silver+s.gold);
  s.stats.carriedWeight=Math.floor((units+59)/60);s.stats.encumbrance=s.stats.carriedWeight>40+Math.floor(s.stats.strength/2)?s.stats.carriedWeight:Math.floor(s.stats.carriedWeight/2);
  s.combat={...e,maxHealth:e.health,returnRoom:s.room,round:0,...(e.sourceStats?{stamina:2*(e.sourceStats.agility+e.sourceStats.vitality)}:{})};if(e.id==='brigand'){s.combat.intent=brigandPose(s);s.combat.heroStamina=s.stats.stamina;}log(s,events,`${e.name} attacks. Choose attack, parry, dodge, cast or flee.`);if(e.id==='brigand')events.push(combatStatus(s));
}
function wildernessEncounter(s:GameState,from:number,c:Campaign,events:string[]){
  const room=c.rooms.find(r=>r.id===s.room),w=c.wilderness;
  if(!w||!room?.encChance||from===45)return;
  let chance=room.encChance;if(isNight(s))chance*=2;if(s.flags.brigandsPursue)chance*=2;
  s.stats.encounterRolls=(s.stats.encounterRolls||0)+1;
  if(roll(s,1,100)>chance)return;
  if(s.stats.gait===2&&trySkill(s,'stealth',chance)&&trySkill(s,'luck')){log(s,events,'A monster just wandered by. You hid in the bushes until it passed.');s.stats.encountersAvoided=(s.stats.encountersAvoided||0)+1;return;}
  const xp=s.stats.experience||0;
  let choice=xp<1000?roll(s,0,3):xp<2000?roll(s,0,6):roll(s,2,6);
  if(isNight(s))choice+=2;
  let arena=w.byRoll[choice]??w.fallback;
  if(w.brigandRooms.includes(s.room))arena=choice<=4||!isNight(s)?465:450;
  const species=w.species.find(e=>e.arena===arena),enemy=c.encounters.find(e=>e.id===species?.enemy);
  if(!enemy||!species)return;
  beginCombat(s,enemy.id,c,events);
  if(s.combat){s.combat.randomEncounter=true;s.combat.canFlee=true;s.combat.reward=roll(s,species.lootMin,species.lootMax);s.combat.stamina=2*((enemy.sourceStats?.agility||0)+(enemy.sourceStats?.vitality||0));}
  s.stats.encountersSeen=(s.stats.encountersSeen||0)+1;
}
// brigandArena.sc:142-207: four guard poses/two idle poses; after the
// animation only one of three state1 decisions advances to the attack. Native
// decisions approximate these phases; they are not original animation timings.
function brigandPose(s:GameState):'guard'|'idle'{const choice=roll(s,0,5);if(s.combat)s.combat.poseTicks=choice===2?88:choice===3?1:44;return [0,1,4,5].includes(choice)?'guard':'idle';}
export function combatStatus(s:GameState):string{const e=s.combat;if(!e)return '';const intent=e.dazzleTicks?'dazzled':e.intent;return intent==='guard'?e.name+' is guarding. Wait for an opening.':intent==='windup'?e.name+' is winding up an attack. Parry or dodge.':intent==='recover'?e.name+' is recovering.':intent==='idle'?e.name+' has lowered his guard.':intent==='dazzled'?e.name+' is dazzled.':'You are fighting '+e.name+'.';}
function interruptCombat(s:GameState,events:string[]){const e=s.combat;if(!e)return;if(e.dazzleTicks)e.dazzleTicks=0;if(e.id==='brigand'){e.intent='windup';events.push('Your hit interrupts the Brigand. He prepares a retaliating strike.');}else if(e.sourceStats){e.intent='recover';events.push(e.name+' reels from your hit.');}}
/** Browser clock seam: one explicit source-informed enemy decision, no world
 * minute or hidden elapsed-time advancement. Ordinary act() retains turns. */
export function combatEnemyBeat(state:GameState,defense:'normal'|'attack'|'parry'|'dodge'='normal'):ActionResult{
  if(!state.combat||state.dead)return {state,events:[]};
  const s=copy(state),events:string[]=[];s.revision++;strikeBack(s,events,defense);if(s.stats.health<=0)s.dead=true;if(s.combat)events.push(combatStatus(s));return {state:s,events};
}
/** Completion seam for the live adapter. Mana/practice were committed at cast
 * input. Source closeCombat:545/638 applies these effects at animation end;
 * Warrior:190 cancels its spell script on hurt. No enemy turn is forced here. */
export function resolveCombatSpell(state:GameState,spell:PendingCombatSpell):ActionResult{
  if(!state.combat||state.dead)return {state,events:[]};
  const s=copy(state),events:string[]=[];s.revision++;
  if(spell.id==='dazzleSpell'){s.combat!.dazzleTicks=spell.power;s.combat!.intent='dazzled';events.push('The flash leaves your opponent dazzled.');}
  else{s.combat!.health-=spell.power;events.push(`Flame Dart strikes for ${spell.power}.`);checkVictory(s,events);if(s.combat)interruptCombat(s,events);}
  return {state:s,events,combatEffect:{hit:spell.id==='flameDartSpell',interrupted:spell.id==='flameDartSpell'}};
}
function combatTired(s:GameState,amount:number){const cached=s.combat?.id==='brigand'?(s.combat.heroStamina??s.stats.stamina):s.stats.stamina,remaining=cached-amount;s.stats.stamina=Math.max(0,remaining);if(s.combat?.id==='brigand')s.combat.heroStamina=s.stats.stamina;if(remaining<0)s.stats.health=Math.max(0,s.stats.health-Math.floor(-remaining/2));}
// Warrior.sc:206-209 owns cached stamina. TrySkill's global-only cost is
// overwritten by the next getTired/setEgoSP, not accumulated in that cache.
function combatPractice(s:GameState,skill:string,bonus=0){if(!s.stats[skill])return;const remaining=s.stats.stamina-roll(s,1,6);s.stats.stamina=Math.max(0,remaining);if(remaining< -3)s.stats.health=Math.max(0,s.stats.health-Math.trunc((-3-remaining)/4));trySkill(s,skill,0,bonus);}
function brigandResponse(s:GameState,events:string[],defense:'normal'|'attack'|'parry'|'dodge',interrupted:boolean){const e=s.combat!;e.intent??=brigandPose(s);if(interrupted){e.intent='windup';events.push('Your hit interrupts the Brigand. He prepares a retaliating strike.');return;}if(e.intent==='windup'){const hero=heroCombatStats(s),chance=clamp(attackLevel(e.sourceStats!,e.stamina||0,true)-defenseLevel(hero,e.heroStamina??s.stats.stamina,defense)+50,5,95);if(roll(s,1,100)<=chance){const damage=sourceDamage(s,e.sourceStats!,hero.armorValue);s.stats.health=Math.max(0,s.stats.health-damage);events.push(e.name+' hits for '+damage+'.');}else events.push('You evade '+e.name+'’s attack.');e.intent='recover';if(!s.stats.health)s.dead=true;return;}if(e.intent==='recover'||e.intent==='dazzled'){e.intent=brigandPose(s);return;}e.intent=roll(s,0,2)===0?'windup':brigandPose(s);}
function heroCombatStats(s:GameState):SourceCombatStats{return {strength:s.stats.strength,intelligence:s.stats.intelligence,agility:s.stats.agility,vitality:s.stats.vitality,luck:s.stats.luck,weaponUse:s.stats.weaponUse,parry:s.stats.parry,dodge:s.stats.dodge,armorValue:s.inventory.chainMail?5:s.inventory.leather?3:0,armorEnc:s.stats.encumbrance||0,shieldValue:s.inventory.shield?10:0,weaponValue:s.inventory.sword?8:s.inventory.dagger?5:0};}
function attackLevel(a:SourceCombatStats,stamina:number,thrust=false){let v=Math.floor((a.weaponUse*8+a.agility*4+a.strength*2+a.intelligence+a.luck)/16);if(stamina<=30)v-=10;if(stamina<=10)v-=20;return v+(thrust?10:0);}
function defenseLevel(a:SourceCombatStats,stamina:number,action:string){let v=Math.floor((a.agility*5+a.intelligence*2+a.luck)/8)-a.armorEnc;if(stamina<=30)v-=5;if(stamina<=10)v-=10;if(action==='attack')v-=5;if(action==='parry'&&a.parry)v+=a.parry+a.shieldValue+Math.floor(a.agility/10);if(action==='dodge'&&a.dodge)v+=a.dodge+Math.floor(a.agility/5);return v;}
function sourceDamage(s:GameState,a:SourceCombatStats,armor:number,extra=0){return Math.max(0,a.weaponValue+Math.floor(a.strength/10)-armor+roll(s,1,6)+extra);}
function applyEffect(s:GameState,e:Effect,c:Campaign,events:string[]){
  if(e.item){s.inventory[e.item]=Math.max(0,(s.inventory[e.item]||0)+(e.amount??1));if(!s.inventory[e.item])delete s.inventory[e.item];}
  if(e.flag){s.flags[e.flag]=e.value!==false;if(e.flag==='babaDeadline')s.stats.babaDeadlineDay=s.day+1;}
  if(e.quest)s.quests[e.quest]=e.stage||'complete';
  if(e.score)s.score+=e.score;
  if(e.silver||e.gold){const funds=Math.max(0,s.silver+s.gold*10+(e.silver||0)+(e.gold||0)*10);s.gold=Math.floor(funds/10);s.silver=funds%10;}
  if(e.room!==undefined)s.room=e.room;
  if(e.learn&&!s.spells.includes(e.learn)){s.spells.push(e.learn);s.stats['spell:'+e.learn]=10;}
  if(e.skill){s.stats[e.skill]=clamp((s.stats[e.skill]||0)+(e.increase||1),0,100);recalculate(s);}
  if(e.dayFlag)s.stats['day:'+e.dayFlag]=s.day;
  if(e.stat)s.stats[e.stat]=e.set??(e.increase===undefined?0:(s.stats[e.stat]||0)+e.increase);
  if(e.heal)s.stats.health=clamp(s.stats.health+e.heal,0,s.stats.maxHealth);
  if(e.sleep){const elapsed=(300-s.minutes+1440)%1440||1440;time(s,elapsed,events);if(!s.dead){s.stats.health=Math.min(s.stats.maxHealth,s.stats.health+Math.floor(elapsed/30));s.stats.mana=Math.min(s.stats.maxMana,s.stats.mana+Math.floor(elapsed/30));s.stats.stamina=s.stats.maxStamina;}}
  if(e.combat)beginCombat(s,e.combat,c,events);
  if(e.win){s.won=true;s.flags.heroOfSpielburg=true;}
}
function strikeBack(s:GameState,events:string[],defense:'normal'|'attack'|'parry'|'dodge'='normal',interrupted=false){
  const e=s.combat;if(!e)return;
  if(e.dazzleTicks){if(interrupted){e.dazzleTicks=0;e.intent=e.id==='brigand'?'windup':'recover';events.push(e.name+' reels from your hit.');return;}e.dazzleTicks=Math.max(0,e.dazzleTicks-18);if(e.dazzleTicks===0&&e.intent==='dazzled')e.intent=e.id==='brigand'?brigandPose(s):'recover';events.push(e.dazzleTicks?e.name+' is still dazzled.':e.name+' recovers its sight.');return;}
  if(e.id==='brigand'&&e.sourceStats){brigandResponse(s,events,defense,interrupted);return;}
  if(interrupted&&e.sourceStats){events.push(e.name+' reels from your hit.');return;}
  if(e.sourceStats){
    const hero=heroCombatStats(s),chance=clamp(attackLevel(e.sourceStats,e.stamina||0)-defenseLevel(hero,s.stats.stamina,defense)+50,5,95);
    if(roll(s,1,100)<=chance){const damage=sourceDamage(s,e.sourceStats,hero.armorValue);s.stats.health=Math.max(0,s.stats.health-damage);events.push(`${e.name} hits for ${damage}.`);}else events.push(`You evade ${e.name}’s attack.`);
    e.stamina=Math.max(0,(e.stamina||0)-4);if(!s.stats.health)s.dead=true;return;
  }
  let reduction=0;
  if(defense==='parry')reduction=3+Math.floor((s.stats.parry||0)/8);
  if(defense==='dodge'&&random(s)<0.35+(s.stats.dodge||0)/200){events.push('You dodge the counterattack.');return;}
  if(s.inventory.shield)reduction+=2;if(s.inventory.chainMail)reduction+=2;
  const damage=Math.max(0,e.power+Math.floor(random(s)*4)-reduction-Math.floor(s.stats.vitality/20));
  s.stats.health=Math.max(e.id==='weaponMaster'?1:0,s.stats.health-damage);events.push(`${e.name} hits for ${damage}.`);
  if(e.id==='weaponMaster'&&(e.round>=6||s.stats.health<=Math.ceil(s.stats.maxHealth/4))){s.stats.weaponUse=Math.min(100,s.stats.weaponUse+2);s.stats.parry=Math.min(100,s.stats.parry+2);s.combat=null;log(s,events,'The Weapon Master ends the practice bout before it becomes dangerous. You have gained experience with sword and shield.');}
  if(s.stats.health===0)s.dead=true;
}
function checkVictory(s:GameState,events:string[]){const e=s.combat;if(!e||e.health>0)return;log(s,events,`You defeat ${e.name}.`);if(e.defeatedFlag)s.flags[e.defeatedFlag]=true;if(e.randomEncounter){s.loot={id:e.id,name:e.name,silver:e.reward,arena:e.arena};s.stats.encountersDefeated=(s.stats.encountersDefeated||0)+1;events.push('You can search the fallen opponent.');}else s.silver+=e.reward;if(e.id==='weaponMaster'){s.stats.weaponUse=Math.min(100,s.stats.weaponUse+3);s.stats.parry=Math.min(100,s.stats.parry+2);}if(!s.flags['score:encounter:'+e.id]){s.score+=5;s.flags['score:encounter:'+e.id]=true;}s.combat=null;}
// gloryInv.sc:111-160, silver override:690-726; pageCode blocks inventory in combat/Maze.
const protectedDrops=new Set(['sword','shield','disenchant','thiefKit','magicGem','ring','brassKey','magicMirror','seed','acorn','fairyDust','greenFur']);
function mayDrop(s:GameState,item:string){return s.room!==322&&s.room!==32&&!s.combat&&!protectedDrops.has(item)&&item!=='gold'&&!(item==='dagger'&&s.inventory.dagger===1&&!s.inventory.sword);}
/** Source merchant catalog for scene/dialogue UI. Showing a catalog never buys. */
export function commerceOptionsFor(s:GameState,c:Campaign,merchantId?:string):CommerceOption[]{
  if(s.dead||s.combat)return [];
  const key=(v:string)=>v.toLowerCase().replace(/^\d+:/,'').trim();
  return c.shops.filter(shop=>shop.room===s.room&&meets(s,shop.when)&&(!merchantId||[shop.merchant?.id,shop.merchant?.name,...shop.merchant?.aliases||[]].some(id=>id&&key(id)===key(merchantId)))).flatMap(shop=>shop.items.map(offer=>{
    const spell=c.spells.find(x=>x.id===offer.item),name=c.items.find(x=>x.id===offer.item)?.name||spell?.name||offer.item,count=offer.count||1,price=offer.item==='chainMail'&&s.inventory.leather?Math.max(0,offer.price-50):offer.price;
    const reason=spell&&s.spells.includes(spell.id)?'You already know that spell.':spell&&!s.stats.magic?'You need magical ability before learning spells.':s.silver+s.gold*10<price?'You cannot afford that purchase.':undefined;
    return {room:shop.room,merchantId:shop.merchant?.id||String(shop.room),merchantName:shop.merchant?.name||'Shopkeeper',item:offer.item,name,count,price,currency:'silver' as const,action:{type:'buy',item:offer.item,label:`Buy ${count>1?count+' ':''}${name} (${price} silver)`},enabled:!reason,...(reason?{reason}:{}),sourceRefs:[...shop.sourceRefs||[]]};
  }));
}
/** Original rm301 comingOut stages: pending1 → served2, with presentation-owned
 * movement/put-down. Only that host's matching arrival may complete an order. */
export function innServiceFor(s:GameState):{kind:'greeting'|'meal'|'coffee';phase:'greeting'|'ordered'|'served';serial:number;completionAction?:Action}|undefined{
  if(s.room!==301||s.combat)return undefined;
  const serial=s.stats.innServiceSerial||0;
  if(s.flags.innMealOrdered||s.flags.innDrinkOrdered)return {kind:s.flags.innMealOrdered?'meal':'coffee',phase:'ordered',serial,completionAction:{type:'service-complete',target:'shema',amount:serial}};
  if(s.flags.innMealReady||s.flags.innDrinkReady)return {kind:s.flags.innMealReady?'meal':'coffee',phase:'served',serial};
  if(s.flags.innSeated&&s.flags.shemaServing)return {kind:'greeting',phase:'greeting',serial};
  return undefined;
}
export function availableActions(s:GameState,c:Campaign):Action[]{
  if(s.dead)return [];
  if(s.combat)return [{type:'attack',label:'Attack'},{type:'parry',label:'Parry'},{type:'dodge',label:'Dodge'},{type:'flee',label:'Flee'},{type:'wait',label:'Wait for an opening'},...s.spells.filter(x=>['flameDartSpell','dazzleSpell','calmSpell','zapSpell'].includes(x)).map(spell=>({type:'cast',spell,label:'Cast '+(c.spells.find(x=>x.id===spell)?.name||spell)})),...['healingPotion','manaPotion','staminaPotion'].filter(item=>s.inventory[item]>0).map(item=>({type:'drink',item,label:'Drink '+(c.items.find(x=>x.id===item)?.name||item)+` (${s.inventory[item]})`}))];
  const out:Action[]=[];
  if(s.droppedItems?.room===s.room)for(const [item,count]of Object.entries(s.droppedItems.items))if(count>0)out.push({type:'take',target:'dropped',item,label:'Pick up dropped '+(c.items.find(x=>x.id===item)?.name||item)+` (${count})`});
  for(const [item,count]of Object.entries(s.inventory))if(count>0&&mayDrop(s,item))out.push({type:'drop',item,label:'Drop '+(c.items.find(x=>x.id===item)?.name||item)});
  if(s.silver>1&&mayDrop(s,'silver'))out.push({type:'drop',item:'silver',label:'Drop silver coins'});
  if(s.loot)out.push({type:'search',target:'corpse',label:'Search the fallen '+s.loot.name});
  out.push({type:'gait',target:s.stats.gait===2?'walk':'sneak',label:s.stats.gait===2?'Walk normally':'Move stealthily'});
  if(s.room===32){
    if(s.minigame?.kind==='maze'&&s.minigame.active){
      out.push({type:'maze-advance',label:`Advance bug (${s.minigame.player}/13; Erasmus ${s.minigame.opponent}/13)`});
      for(const o of s.minigame.obstacles||[])if(!o.cleared){const spell=o.kind==='rock'?'openSpell':'fetchSpell';if(s.spells.includes(spell))out.push({type:'maze-spell',target:o.id,spell,label:`${c.spells.find(x=>x.id===spell)?.name}: ${o.kind} at ${o.x},${o.y}`});}
      if(s.spells.includes('triggerSpell'))out.push({type:'maze-spell',target:'playerBug',spell:'triggerSpell',label:`Trigger: change bug form (current ${s.stats.mazeForm||0})`});
      if(s.spells.includes('flameDartSpell'))out.push({type:'maze-spell',target:'wizBug',spell:'flameDartSpell',label:'Flame Dart: delay Erasmus’s bug'});
      out.push({type:'maze-quit',label:'Concede Mage’s Maze'});
    }else out.push({type:'maze-start',label:'Play Mage’s Maze'});
  }
  if(s.room===340){
    if(s.minigame?.kind==='darts'&&s.minigame.active)out.push({type:'dart-force',amount:-1,label:'Less force'},{type:'dart-force',amount:1,label:'More force'},{type:'dart-angle',amount:-1,label:'Aim left'},{type:'dart-angle',amount:1,label:'Aim right'},{type:'dart-throw',label:`Throw (force ${s.minigame.force}, angle ${s.minigame.angle}; score ${s.minigame.player}–${s.minigame.opponent})`},{type:'dart-quit',label:'Forfeit Dag-Nab-It'});
    else out.push({type:'dart-start',amount:5,label:'Play Dag-Nab-It — wager 5 silver'},{type:'dart-start',amount:25,label:'Play Dag-Nab-It — wager 25 silver'});
  }
  for(const r of c.rules)if(active(s,r)){
    if(r.action.type==='dialogue')continue;
    if(!meets(s,r.requires))continue;
    if(r.action.item&&!(r.action.item==='silver'?s.gold*10+s.silver:s.inventory[r.action.item]))continue;
    if(r.action.spell&&!s.spells.includes(r.action.spell))continue;
    out.push({...r.action,label:r.label||r.action.label||r.action.type+' '+(r.action.target||r.action.item||'')});
  }
  for(const a of c.rooms.find(r=>r.id===s.room)?.actions||[])out.push(a);
  for(const offer of commerceOptionsFor(s,c))if(offer.enabled)out.push(offer.action);
  for(const to of c.rooms.find(r=>r.id===s.room)?.exits||[])out.push({type:'move',to,label:'Go to '+(c.rooms.find(r=>r.id===to)?.name||to)});
  out.push({type:'rest',label:'Rest for one hour'},{type:'wait',amount:60,label:'Wait one hour'});
  if(s.inventory.rations)out.push({type:'eat',item:'rations',label:'Eat a ration'});
  for(const item of ['healingPotion','manaPotion','staminaPotion'])if(s.inventory[item])out.push({type:'drink',item,label:'Drink '+(c.items.find(x=>x.id===item)?.name||item)});
  return out.filter((a,i,arr)=>arr.findIndex(b=>JSON.stringify({...a,label:undefined})===JSON.stringify({...b,label:undefined}))===i);
}
/** Original dropped inventory lasts only until the next room transition (n896.sc:40-43). */
export function act(state:GameState,action:Action,campaign:Campaign,options:ActOptions={}):ActionResult{
 const result=actInternal(state,action,campaign,options);
 if(result.state.droppedItems&&result.state.room!==result.state.droppedItems.room){delete result.state.droppedItems;log(result.state,result.events,'You leave the unrecovered items behind. Dropped items are lost when leaving the room, as in the original game.');}
 return result;
}
function actInternal(state:GameState,action:Action,campaign:Campaign,options:ActOptions={}):ActionResult{
  const s=copy(state),events:string[]=[];s.revision++;
  if(s.dead)return {state:s,events:['Your adventure has ended. Restore a saved game.']};
  if(action.type==='stand'){
    if(s.room!==301||action.target!=='bench'||!s.flags.innSeated)return {state:s,events:['You are already standing.']};
    if(s.flags.innMealOrdered||s.flags.innDrinkOrdered)return {state:s,events:['You should wait for Shema to bring you what you ordered.']};
  }
  if(action.type==='service-complete'){
    const service=innServiceFor(s);
    if(action.target!=='shema'||!service||service.phase!=='ordered'||action.amount!==service.serial)return {state:s,events:['That serving has already finished or is no longer pending.']};
    const meal=service.kind==='meal';s.flags[meal?'innMealOrdered':'innDrinkOrdered']=false;s.flags[meal?'innMealReady':'innDrinkReady']=true;
    log(s,events,meal?'Shema sets your meal on the table.':'Shema sets your coffee on the table.');return {state:s,events};
  }
  if(action.type==='drop'||(action.type==='take'&&action.target==='dropped')){
    const item=action.item||'',name=campaign.items.find(x=>x.id===item)?.name;
    if(!name)return {state:s,events:['That inventory item does not exist.']};
    if(s.combat||s.room===32)return {state:s,events:['Inventory dropping and pickup are unavailable during combat or Mage’s Maze.']};
    if(action.type==='drop'){
      if(s.room===322)return {state:s,events:['It would not be a good idea to drop anything here.']};
      if(item==='gold'||(item==='silver'&&s.silver<=1))return {state:s,events:['You start to drop your gold, but think better of it.']};
      if(protectedDrops.has(item))return {state:s,events:['You don’t really want to drop your '+name+'.']};
      if(item==='dagger'&&s.inventory.dagger===1&&!s.inventory.sword)return {state:s,events:['You don’t really want to drop your last weapon.']};
      if(item!=='silver'&&!(s.inventory[item]>0))return {state:s,events:['You do not have that item.']};
      const amount=item==='silver'?(s.silver>10?10:s.silver-1):1;
      if(item==='silver')s.silver-=amount;else if(!--s.inventory[item])delete s.inventory[item];
      if(!s.droppedItems||s.droppedItems.room!==s.room)s.droppedItems={room:s.room,items:{}};
      s.droppedItems.items[item]=(s.droppedItems.items[item]||0)+amount;
      log(s,events,item==='silver'?'You drop '+amount+' silver coins.':'You drop your '+name+'.');events.push('Recover dropped items before leaving this room; the original game discards them on departure.');
    }else{
      const pile=s.droppedItems?.room===s.room?s.droppedItems.items:undefined,count=pile?.[item]||0;
      if(!pile||!count)return {state:s,events:['There is nothing to pick up.']};
      const amount=item==='silver'?Math.min(10,count):1;
      if(item==='silver')s.silver+=amount;else s.inventory[item]=(s.inventory[item]||0)+amount;
      pile[item]-=amount;if(!pile[item])delete pile[item];if(!Object.keys(pile).length)delete s.droppedItems;
      log(s,events,item==='silver'?'You pick up '+amount+' silver coins.':'You pick up your '+name+'.');
    }
    return {state:s,events};
  }
  if(action.type==='dialogue')s.flags[`heard:${s.room}:${action.target}:${action.topic}`]=true;
  if(s.room===334&&action.type==='use'&&action.target==='slink'&&action.item==='silver'&&s.flags.slinkAmbushed&&!s.flags.slinkReleased){
    if(s.gold*10+s.silver<5)return {state:s,events:['You have too little money to buy your way out. Try another way to deal with the thieves.']};
    const rule=campaign.rules.find(r=>r.id==='slink-pay-cash'&&active(s,r)&&matches(action,r.action)&&meets(s,r.requires));
    if(rule){s.gold=0;s.silver=0;s.flags.slinkReleased=true;for(const e of rule.effects)applyEffect(s,e,campaign,events);if(rule.once!==false)s.flags['rule:'+rule.id]=true;log(s,events,rule.text||'You hand over all your money. The thieves tell you to leave quickly.');return {state:s,events,matchedRuleIds:[rule.id]};}
  }
  const meepTrick=s.room===60&&action.type==='use'&&action.target==='bossMeep'?campaign.rules.find(r=>r.id==='meep-tricks'&&active(s,r)&&matches(action,r.action)&&meets(s,r.requires)):undefined;
  if(meepTrick){
    if(!s.flags.meepScrollVisible&&!s.flags.meepScrollConsumed){s.flags.meepScrollVisible=true;events.push('The green Meep throws a scroll onto the ground.');}
    else if(!s.flags.meepBabyShown&&roll(s,0,1)===0){s.flags.meepBabyShown=true;events.push('The Meep brings out a baby Meep and sends it scampering between the holes.');}
    else{s.flags.meepApplesShown=true;events.push('The Meep juggles apples and tosses one into the air.');}
    for(const e of meepTrick.effects)applyEffect(s,e,campaign,events);if(meepTrick.once!==false)s.flags['rule:'+meepTrick.id]=true;if(meepTrick.text)log(s,events,meepTrick.text);time(s,meepTrick.minutes??1,events);return {state:s,events,matchedRuleIds:[meepTrick.id]};
  }
  if(action.type==='gait'&&!s.combat){s.stats.gait=action.target==='sneak'?2:action.target==='run'?1:0;return {state:s,events:[s.stats.gait===2?'You move stealthily, seeking cover.':s.stats.gait===1?'You begin running.':'You walk normally.']};}
  if(action.type==='search'&&action.target==='corpse'&&!s.combat){if(!s.loot)return {state:s,events:['There is no fallen opponent to search.']};const loot=s.loot;applyEffect(s,{silver:loot.silver},campaign,events);log(s,events,loot.silver?`You search ${loot.name} and find ${loot.silver} silver coins.`:'You search the opponent but find no treasure.');if(loot.arena===440&&s.flags.knowsClawValue){const count=roll(s,4,10);applyEffect(s,{item:'cheetaurClaw',amount:count},campaign,events);events.push(`You remove ${count} Cheetaur claws for the Healer.`);}if(loot.arena===450&&s.flags.knowsBeardValue){applyEffect(s,{item:'trollBeard'},campaign,events);events.push('You remove the Troll’s beard for the Healer.');}delete s.loot;time(s,3,events);return {state:s,events};}
  if((action.type==='inspect'||action.type==='look')&&!campaign.rules.some(r=>active(s,r)&&matches(action,r.action))){
    const item=campaign.items.find(x=>x.id===action.target);return {state:s,events:[item?.description||campaign.rooms.find(r=>r.id===s.room)?.description||'Look closely at the scene, then select an object or a person.']};
  }
  if(s.room===32&&action.type.startsWith('maze-')){
    if(action.type==='maze-start'){
      if(!['openSpell','fetchSpell','triggerSpell','flameDartSpell'].every(x=>s.spells.includes(x)))return {state:s,events:['Erasmus’s game requires Open, Fetch, Trigger and Flame Dart. Learn the spells before playing.']};
      const p=[['rock',40,20],['rock',274,23],['rock',201,50],['rock',130,86],['bridge',79,6],['bridge',137,6],['bridge',223,6],['bridge',28,38],['bridge',56,58],['ladder',82,41],['ladder',49,81]] as const;
      const chosen=p.map((xy,i)=>({id:'maze-object-'+i,kind:xy[0],x:xy[1],y:xy[2],cleared:false}));
      s.minigame={kind:'maze',active:true,round:0,player:0,opponent:0,obstacles:chosen};s.stats.mazeForm=0;
      log(s,events,'Mage’s Maze begins. Guide your bug through thirteen sections before Erasmus. Open relocates rocks, Fetch repositions bridges and ladders, Trigger changes the bug’s form, and Flame Dart delays the opposing bug.');
    }else{
      const g=s.minigame;if(!g||g.kind!=='maze'||!g.active)return {state:s,events:['Start a Mage’s Maze game first.']};
      if(action.type==='maze-quit'){g.active=false;events.push('You concede the game to Erasmus.');return {state:s,events};}
      if(action.type==='maze-spell'){
        const spell=campaign.spells.find(x=>x.id===action.spell),o=g.obstacles?.find(x=>x.id===action.target&&!x.cleared);
        if(!spell||!s.spells.includes(spell.id))return {state:s,events:['You do not know that spell.']};
        if(s.stats.mana<spell.cost)return {state:s,events:['You need more mana. Drink a power potion or concede and rest.']};
        if(!o&&!['triggerSpell','flameDartSpell'].includes(spell.id))return {state:s,events:['Select a remaining maze object.']};
        s.stats.mana-=spell.cost;
        if(spell.id==='openSpell'&&o?.kind==='rock'){o.cleared=true;events.push('The rock relocates to another alcove, opening your route.');}
        else if(spell.id==='fetchSpell'&&o&&['bridge','ladder'].includes(o.kind)){o.cleared=true;events.push(`You reposition the ${o.kind} to help your bug cross.`);}
        else if(spell.id==='triggerSpell'){s.stats.mazeForm=((s.stats.mazeForm||0)+1)%3;events.push('The bug changes form. Its movement over maze hazards changes.');}
        else if(spell.id==='flameDartSpell'){g.opponent=Math.max(0,g.opponent-2);events.push('The flame delays Erasmus’s bug.');}
        else events.push('That spell does not solve this kind of obstacle.');
      }else if(action.type==='maze-advance'){
        const block=g.obstacles?.find((o,i)=>!o.cleared&&i<=g.player);
        if(block){events.push(`Your bug is blocked by a ${block.kind} at ${block.x},${block.y}. Use the appropriate spell.`);return {state:s,events};}
        if(g.player===6&&s.stats.mazeForm!==1){events.push('A water crossing blocks the ordinary bug form. Use Trigger to change to the form that can cross water.');return {state:s,events};}
        g.player++;events.push(`Your bug advances to section ${g.player}.`);
      }
      g.round++;if(g.round%3===0)g.opponent++;
      if(g.player>=13){g.active=false;s.flags.mazeWon=true;if(!s.spells.includes('dazzleSpell')){s.spells.push('dazzleSpell');s.score+=12;}log(s,events,'Your bug wins the race. Erasmus teaches you his Razzle Dazzle spell.');}
      else if(g.opponent>=13){g.active=false;log(s,events,'Erasmus’s bug reaches the finish first. You can rest and try again.');}
    }
    time(s,1,events);return {state:s,events};
  }
  if(s.room===340&&action.type.startsWith('dart-')){
    const funds=s.silver+s.gold*10;
    if(action.type==='dart-start'){
      const wager=clamp(Math.floor(action.amount||5),1,51);if(funds<wager)return {state:s,events:['You cannot wager silver you do not have.']};
      if(!s.inventory.thiefLicense)return {state:s,events:['Buy a Thieves’ Guild license before using its services.']};
      const remaining=funds-wager;s.gold=Math.floor(remaining/10);s.silver=remaining%10;
      s.minigame={kind:'darts',active:true,round:0,player:0,opponent:0,wager,force:5,angle:7,handX:100+Math.floor(random(s)*130),handY:189+Math.floor(random(s)*15)};
      log(s,events,`Dag-Nab-It: nine knives each, in three rounds. The wager is ${wager} silver. Set force (0–11) and angle (0–14). Your hand is at ${s.minigame.handX},${s.minigame.handY}.`);
    }else{
      const g=s.minigame;if(!g||g.kind!=='darts'||!g.active)return {state:s,events:['Start a wager first.']};
      if(action.type==='dart-quit'){g.active=false;events.push('You forfeit your wager.');return {state:s,events};}
      if(action.type==='dart-force'){g.force=clamp((g.force||0)+(action.amount||1),0,11);events.push('Force: '+g.force);return {state:s,events};}
      if(action.type==='dart-angle'){g.angle=clamp((g.angle||0)+(action.amount||1),0,14);events.push('Angle: '+g.angle);return {state:s,events};}
      if(action.type==='dart-throw'){
        const jitter=Math.min(Math.floor((100-s.stats.luck)/4),Math.max(2,Math.floor((100-s.stats.throwing)/8)));
        const x=(g.handX||160)+12*((g.angle||0)-7)+Math.floor(random(s)*(jitter+1))-Math.floor(jitter/2);
        const y=135-10*(g.force||0)-(203-(g.handY||196))+Math.floor(random(s)*(jitter+1))-Math.floor(jitter/2);
        const radius=Math.hypot((x-159)/1.15,y-76);const points=radius<8?4:radius<18?3:radius<30?2:radius<44?1:0;
        g.player+=points;g.round++;const opponentError=6+Math.floor(random(s)*20);const other=opponentError<9?4:opponentError<17?3:2;g.opponent+=other;
        s.stats.throwing=Math.min(100,s.stats.throwing+1);events.push(`Knife ${g.round}/9 lands at ${x},${y}: ${points} points. Opponent: ${other}. Total ${g.player}–${g.opponent}.`);
        g.handX=100+Math.floor(random(s)*130);g.handY=189+Math.floor(random(s)*15);
        if(g.round>=9){g.active=false;if(g.player>g.opponent){applyEffect(s,{silver:(g.wager||0)*2},campaign,events);if((g.wager||0)>=25&&!s.flags.dartsWon){s.score+=5;s.flags.dartsWon=true;}log(s,events,'You win Dag-Nab-It and collect both stakes.');}else if(g.player===g.opponent){applyEffect(s,{silver:g.wager},campaign,events);events.push('A tie. Your stake is returned.');}else events.push('You lose the wager. Practice throwing and calibrate your force and angle.');}
        else events.push(`Next hand position: ${g.handX},${g.handY}.`);
      }
    }
    time(s,1,events);return {state:s,events};
  }
  if(action.type==='allocate'){
    const skill=action.target||'',amount=Math.floor(action.amount||5),cost=amount+(s.stats[skill]===0?10:0);
    if(!['strength','agility','vitality','intelligence','luck','weaponUse','parry','dodge','stealth','climbing','throwing','pickLocks','magic'].includes(skill)||amount<=0||cost>s.stats.unspent||(s.stats[skill]===0&&amount<5))return {state:s,events:['Allocate within your remaining points. Learning an absent skill costs ten extra points and starts at five.']};
    s.stats[skill]=clamp(s.stats[skill]+amount,0,100);s.stats.unspent-=cost;recalculate(s);
    return {state:s,events:[`${amount} points assigned to ${skill}.`]};
  }
  if(action.type==='drink'||action.type==='eat'){
    const item=action.item||(action.type==='eat'?'rations':'healingPotion');if(!s.inventory[item])return {state:s,events:['You do not have that item.']};
    if(!['rations','healingPotion','manaPotion','staminaPotion'].includes(item))return {state:s,events:['That is not safe to consume.']};
    s.inventory[item]--;if(!s.inventory[item])delete s.inventory[item];
    if(item==='rations'){s.stats.hunger=0;log(s,events,'You eat a ration.');}
    // egoSez.sc:56-74,344-353; wizGame.sc:1150-1157.
    if(item==='healingPotion'){s.stats.health=Math.min(s.stats.maxHealth,s.stats.health+Math.floor(s.stats.maxHealth/2));log(s,events,'The healing potion restores half your maximum health.');}
    if(item==='manaPotion'){s.stats.mana=Math.min(s.stats.maxMana,s.stats.mana+Math.floor(s.stats.maxMana/2));log(s,events,'The power potion restores half your maximum magical energy.');}
    if(item==='staminaPotion'){s.stats.stamina=s.stats.maxStamina;if(s.combat?.id==='brigand')s.combat.heroStamina=s.stats.stamina;log(s,events,'You feel energetic again.');}
    if(['healingPotion','manaPotion','staminaPotion'].includes(item)){s.inventory.flask=(s.inventory.flask||0)+1;events.push('You keep the empty flask.');}
    time(s,1,events);return {state:s,events};
  }
  if(s.combat){
    const enemy=s.combat;enemy.round++;time(s,1,events);let interrupted=false;
    if(enemy.id==='brigand'&&!enemy.intent)enemy.intent=brigandPose(s);
    if(action.type==='flee'){
      if(enemy.randomEncounter){s.combat=null;s.stats.encountersFled=(s.stats.encountersFled||0)+1;log(s,events,'You withdraw from combat and return to the forest.');return {state:s,events};}
      if([14,171,88,89,93,73,91].includes(s.room)){events.push('You cannot escape this encounter.');return {state:s,events};}
      if(enemy.sourceStats&&enemy.arena){s.combat=null;log(s,events,'You withdraw from combat and return to the forest.');return {state:s,events};}
      if(random(s)<0.6+s.stats.agility/250){s.combat=null;log(s,events,'You escape before the next blow.');}else{events.push('Your retreat is blocked.');strikeBack(s,events);}return {state:s,events};
    }
    if(action.type==='attack'){
      combatTired(s,4);const hero=heroCombatStats(s);let hit:boolean,damage:number;
      if(enemy.sourceStats){if(enemy.id==='brigand')combatPractice(s,'weaponUse');else trySkill(s,'weaponUse');if((enemy.heroStamina??s.stats.stamina)<=0){s.stats.health=0;s.dead=true;log(s,events,'You collapse from exhaustion during combat. Restore a save or retreat before exhausting your stamina.');return {state:s,events};}const chance=clamp(attackLevel(hero,enemy.heroStamina??s.stats.stamina,true)-defenseLevel(enemy.sourceStats,enemy.stamina||0,enemy.id==='brigand'?(enemy.intent==='guard'?'parry':enemy.intent==='windup'?'attack':'normal'):'attack')+50,5,95);hit=roll(s,1,100)<=chance;if(enemy.id==='brigand'&&enemy.intent==='guard')hit=false;damage=hit?sourceDamage(s,hero,enemy.sourceStats.armorValue,s.flags.weaponZapped?5+Math.floor((s.stats['spell:zapSpell']||0)/10):0):0;}
      else {hit=random(s)<0.65+s.stats.weaponUse/250-enemy.defense/200;damage=hit?sourceDamage(s,hero,enemy.defense,s.flags.weaponZapped?5+Math.floor((s.stats['spell:zapSpell']||0)/10):0):0;s.stats.weaponUse=Math.min(100,s.stats.weaponUse+1);}
      enemy.health-=damage;events.push(hit?`You strike for ${damage}.`:'Your strike misses.');if(hit)s.flags.weaponZapped=false;interrupted=hit;
    }else if(action.type==='cast'){
      const spell=campaign.spells.find(x=>x.id===action.spell);
      if(!spell||!s.spells.includes(spell.id))return {state:s,events:['You have not learned that spell.']};
      if(s.stats.mana<spell.cost)return {state:s,events:['You do not have enough magical energy.']};
      s.stats.mana-=spell.cost;
      if(spell.id==='calmSpell'&&!['kobold','minotaur','brigand'].includes(enemy.id)){s.combat=null;events.push('The creature calms down and lets you withdraw.');return {state:s,events};}
      if(options.deferCastEffect&&options.combatCadence==='clock'&&['dazzleSpell','flameDartSpell'].includes(spell.id)){
        const pendingSpell:PendingCombatSpell={id:spell.id as PendingCombatSpell['id'],power:spell.id==='dazzleSpell'?Math.max(3,3*(s.stats['spell:dazzleSpell']||5)):5+Math.floor((s.stats['spell:flameDartSpell']||5)/3)};
        if(!s.stats['spell:'+spell.id])s.stats['spell:'+spell.id]=5;trySkill(s,'spell:'+spell.id);skillUsed(s,'magic',Math.floor(spell.cost/2));skillUsed(s,'intelligence',Math.floor(spell.cost/5));
        events.push('You begin casting '+spell.name+'.');return {state:s,events,combatEffect:{hit:false,interrupted:false,pendingSpell}};
      }
      if(spell.id==='dazzleSpell'){enemy.dazzleTicks=Math.max(3,3*(s.stats['spell:dazzleSpell']||5));enemy.intent='dazzled';trySkill(s,'spell:dazzleSpell');skillUsed(s,'magic',Math.floor(spell.cost/2));skillUsed(s,'intelligence',Math.floor(spell.cost/5));events.push('The flash leaves your opponent dazzled.');return {state:s,events};}
      if(spell.id==='zapSpell'){s.flags.weaponZapped=true;events.push('Your weapon glows with magical force.');}
      else if(spell.id==='flameDartSpell'){const damage=5+Math.floor((s.stats['spell:flameDartSpell']||5)/3);enemy.health-=damage;interrupted=true;events.push(`Flame Dart strikes for ${damage}.`);}
      else events.push('That spell does not harm this opponent.');
      if(!s.stats['spell:'+spell.id])s.stats['spell:'+spell.id]=5;trySkill(s,'spell:'+spell.id);skillUsed(s,'magic',Math.floor(spell.cost/2));skillUsed(s,'intelligence',Math.floor(spell.cost/5));
    }else if(!['parry','dodge','wait'].includes(action.type))return {state:s,events:['You must deal with your opponent first.']};
    if(enemy.id==='brigand'&&action.type==='parry'){combatTired(s,1);combatPractice(s,'parry',20);}if(enemy.id==='brigand'&&action.type==='dodge'){combatTired(s,2);combatPractice(s,'dodge',20);}
    if(action.type==='wait')events.push('You wait for an opening.');
    checkVictory(s,events);if(s.combat){if(options.combatCadence==='clock'){if(interrupted)interruptCombat(s,events);}else strikeBack(s,events,action.type==='parry'?'parry':action.type==='dodge'?'dodge':action.type==='attack'?'attack':'normal',interrupted);}
    if(enemy.id!=='brigand'&&action.type==='parry'){s.stats.stamina=Math.max(0,s.stats.stamina-1);if(enemy.sourceStats)trySkill(s,'parry');else if(s.stats.parry)s.stats.parry=Math.min(100,s.stats.parry+1);}if(enemy.id!=='brigand'&&action.type==='dodge'){s.stats.stamina=Math.max(0,s.stats.stamina-2);if(enemy.sourceStats)trySkill(s,'dodge');else if(s.stats.dodge)s.stats.dodge=Math.min(100,s.stats.dodge+1);}
    if(s.combat&&(s.combat.heroStamina??s.stats.stamina)<=0){s.stats.health=0;s.dead=true;log(s,events,'You collapse from exhaustion during combat. Restore a save or retreat before exhausting your stamina.');}
    if(s.combat?.id==='brigand')events.push(combatStatus(s));if(s.stats.health<=0)s.dead=true;
    return {state:s,events,combatEffect:{hit:interrupted,interrupted}};
  }
  const candidates=campaign.rules.filter(r=>active(s,r)&&matches(action,r.action)).sort((a,b)=>['target','item','spell','topic','to'].filter(k=>(b.action as any)[k]!==undefined).length-['target','item','spell','topic','to'].filter(k=>(a.action as any)[k]!==undefined).length);
  const rule=candidates.find(r=>meets(s,r.requires));
  if(rule){
    if(rule.id.startsWith('wall-climb-')&&(!trySkill(s,'climbing',35)||(rule.id==='wall-climb-64'&&!trySkill(s,'climbing',35)))){time(s,1,events);return {state:s,events:['Climbing this wall is too difficult for your level of skill. Keep practicing.']};}
    if(['sleep-ejected-38','sleep-ejected-41'].includes(rule.id)&&s.minutes>300&&s.minutes<1020)time(s,1260-s.minutes,events);
    if(action.type==='cast'){
      const sp=campaign.spells.find(x=>x.id===action.spell);
      if(!sp||!s.spells.includes(sp.id))return {state:s,events:['You have not learned that spell.']};
      if(s.stats.mana<sp.cost)return {state:s,events:['You need more magical energy.']};s.stats.mana-=sp.cost;
    }
    for(const e of rule.effects){if(e.score&&s.flags['score:'+rule.id])continue;applyEffect(s,e,campaign,events);}
    if(rule.effects.some(e=>e.score))s.flags['score:'+rule.id]=true;
    if(s.room===96&&action.target!=='chain'&&s.stats.yorickDoorTimer>0)s.stats.yorickDoorTimer--;
    if(rule.once!==false)s.flags['rule:'+rule.id]=true;
    if(rule.text)log(s,events,rule.text);time(s,rule.minutes??5,events);return {state:s,events,matchedRuleIds:[rule.id]};
  }
  const blocked=candidates[0];
  if(blocked)return {state:s,events:[blocked.blocked||'You are not yet prepared for that. Explore, practice your skills or find the required item.']};
  if(action.type==='dialogue'){s.flags[`heard:${s.room}:${action.target}:${action.topic}`]=true;return {state:s,events};}
  if(action.type==='move'){
    if(s.room===334&&s.flags.slinkAmbushed&&!s.flags.slinkReleased){s.stats.health=0;s.dead=true;log(s,events,'You try to leave before satisfying the thieves. Sneak’s dagger ends your adventure. Restore a save.');return {state:s,events};}
    if(s.room===301&&(s.flags.innMealOrdered||s.flags.innDrinkOrdered||s.flags.innMealReady||s.flags.innDrinkReady))return {state:s,events:[s.flags.innMealOrdered||s.flags.innDrinkOrdered?'Wait for Shema to finish serving you.':s.flags.innMealReady?'Eat your meal first.':'Finish your drink.']};
    if(s.room===301&&s.flags.innSeated)return {state:s,events:['You are seated at the table. Stand up from the chair before walking away.']};
    if(!Number.isInteger(action.to)||!campaign.rooms.find(r=>r.id===s.room)?.exits?.includes(action.to!))return {state:s,events:['There is no accessible exit to that location.']};
    const gate=campaign.gates?.find(g=>g.from===s.room&&g.to===action.to&&!meets(s,g.requires));if(gate)return {state:s,events:[gate.blocked]};
    if(s.room===55&&s.flags.dispelBrewing)s.flags.dispelReady=true;
    if(s.room===301){s.flags.innCoffeeConsumed=false;s.flags.innSeated=false;s.flags.shemaServing=false;s.flags.innMealConsumed=false;s.flags.innDrinkConsumed=false;}
    const from=s.room;if(from===93)s.flags.minotaurCalmed=false;if(from===97)s.flags.brigandsPursue=true;if(from===83)s.flags.hermitHospitality=true;if(from===301)s.flags.abdullaPresent=false;if(from===331)s.stats.crusherQuestions=0;delete s.loot;
    if(s.minigame?.active)s.minigame.active=false;
    s.room=action.to!;s.flags['visited:'+s.room]=true;time(s,5,events);if(s.room===331)s.stats.crusherQuestions=0;if(s.room===301){s.flags.abdullaPresent=s.minutes>=1020&&s.minutes<1380&&(!s.flags.abdullaMet||roll(s,0,1)===1);if(s.flags.abdullaPresent)s.flags.abdullaMet=true;}s.stats.stamina=Math.max(0,s.stats.stamina-1);events.push('You enter '+(campaign.rooms.find(r=>r.id===s.room)?.name||s.room)+'.');if(!s.dead)wildernessEncounter(s,from,campaign,events);return {state:s,events};
  }
  if(action.type==='buy'){
    const shop=campaign.shops.find(x=>x.room===s.room&&x.items.some(i=>i.item===action.item));if(!shop)return {state:s,events:['That item is not sold here.']};
    if(!meets(s,shop.when))return {state:s,events:[shop.closedText||'The merchant is not available here now.']};
    const offer=shop.items.find(x=>x.item===action.item)!;
    const lesson=campaign.spells.find(x=>x.id===offer.item);if(lesson&&(!s.stats.magic||s.spells.includes(lesson.id)))return {state:s,events:[s.spells.includes(lesson.id)?'You already know that spell.':'You need magical ability before learning spells.']};
    const price=offer.item==='chainMail'&&s.inventory.leather?Math.max(0,offer.price-50):offer.price;
    const funds=s.silver+s.gold*10;if(funds<price)return {state:s,events:['You cannot afford that purchase.']};
    const balance=funds-price;s.gold=Math.floor(balance/10);s.silver=balance%10;if(lesson){s.spells.push(lesson.id);s.stats['spell:'+lesson.id]=5;}else s.inventory[offer.item]=(s.inventory[offer.item]||0)+(offer.count||1);if(offer.item==='chainMail')delete s.inventory.leather;time(s,2,events);log(s,events,'You purchase '+(campaign.items.find(x=>x.id===offer.item)?.name||lesson?.name||offer.item)+'.');return {state:s,events};
  }
  if(action.type==='wait'){time(s,clamp(Math.floor(action.amount||15),1,720),events);events.push('Time passes.');return {state:s,events};}
  if(action.type==='rest'){
    if([10,301,83,76].includes(s.room)){
      const amount=clamp(Math.floor(action.amount||60),15,480);time(s,amount,events);s.stats.health=Math.min(s.stats.maxHealth,s.stats.health+Math.floor(amount/3));s.stats.stamina=s.stats.maxStamina;s.stats.mana=Math.min(s.stats.maxMana,s.stats.mana+Math.floor(amount/2));log(s,events,'You rest in safety and recover.');
    }else events.push('This is not a safe place to rest. Try the inn, Erana’s Peace or the hermit.');return {state:s,events};
  }
  if(action.type==='train'){
    const skill=action.target||'weaponUse';if(!Object.keys(s.stats).includes(skill)||['health','stamina','mana','unspent','hunger'].includes(skill)||skill.startsWith('max'))return {state:s,events:['That is not a trainable skill.']};
    if(s.stats.stamina<10)return {state:s,events:['You are too exhausted to practice.']};if(s.stats[skill]===0)return {state:s,events:['Spend character points to learn the basics before practicing this skill.']};
    s.stats.stamina-=10;s.stats[skill]=Math.min(100,s.stats[skill]+3);recalculate(s);time(s,15,events);log(s,events,`You practice ${skill}.`);return {state:s,events};
  }
  if(action.type==='cast')return {state:s,events:['That spell has no useful effect on this target here.']};
  return {state:s,events:['No implemented interaction matches that action here. Other source interactions may still be awaiting reconstruction.']};
}
export function serializeGame(state:GameState):string{return JSON.stringify(state,null,2);}
export function deserializeGame(text:string,campaign?:Campaign):GameState{
  const s=JSON.parse(text);const errors=validateSave(s,campaign);if(errors.length)throw new Error(errors.join('; '));return s;
}
export function validateSave(s:any,c?:Campaign):string[]{
  const e:string[]=[];
  const record=(v:any):v is Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
  const nonnegative=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  const integer=(v:any)=>Number.isInteger(v)&&v>=0;
  const text=(v:any)=>typeof v==='string'&&v.length>0;
  if(!record(s)||s.version!==1)return ['Unsupported save version.'];
  if(!['fighter','magic-user','thief'].includes(s.heroClass))e.push('Invalid hero class.');
  if(!text(s.heroName)||!s.heroName.trim()||s.heroName.length>48||!integer(s.room))e.push('Invalid hero or room.');
  if(c&&!c.rooms.some(r=>r.id===s.room))e.push('This save refers to a room absent from this content revision.');
  for(const k of ['minutes','day','gold','silver','score','revision','seed'])if(!integer(s[k]))e.push('Invalid '+k+'.');
  if(s.minutes>=1440||s.day<1||s.seed>0xffffffff)e.push('Invalid clock, day or random seed.');
  for(const k of ['stats','inventory','flags','quests'])if(!record(s[k]))e.push('Invalid '+k+' map.');
  if(record(s.stats)){
    for(const k of ['strength','agility','vitality','intelligence','luck','weaponUse','parry','dodge','stealth','climbing','throwing','pickLocks','magic','health','maxHealth','stamina','maxStamina','mana','maxMana','hunger','unspent'])if(!nonnegative(s.stats[k]))e.push('Missing or invalid required stat '+k+'.');
    for(const [k,v] of Object.entries(s.stats))if(!nonnegative(v))e.push('Invalid stat '+k+'.');
    if(s.stats.maxHealth<=0||s.stats.maxStamina<=0||s.stats.health>s.stats.maxHealth||s.stats.stamina>s.stats.maxStamina||s.stats.mana>s.stats.maxMana)e.push('Invalid vital-stat bounds.');
  }
  if(record(s.inventory))for(const [k,v] of Object.entries(s.inventory)){if(!integer(v))e.push('Invalid item amount '+k+'.');if(c&&!c.items.some(item=>item.id===k))e.push('Saved item absent from this content revision: '+k+'.');}
  if(s.droppedItems!==undefined){const d=s.droppedItems;if(!record(d)||!integer(d.room)||d.room!==s.room||!record(d.items))e.push('Invalid dropped inventory.');else for(const [item,count]of Object.entries(d.items)){if(!integer(count)||count<1)e.push('Invalid dropped item amount '+item+'.');if(c&&!c.items.some(x=>x.id===item))e.push('Unknown dropped item '+item+'.');}}
  if(record(s.flags)&&Object.values(s.flags).some(v=>typeof v!=='boolean'))e.push('Invalid flag value.');
  if(record(s.flags)&&record(s.stats)){
    const ordered=+!!s.flags.innMealOrdered + +!!s.flags.innDrinkOrdered,served=+!!s.flags.innMealReady + +!!s.flags.innDrinkReady;
    if(ordered>1||served>1||ordered&&served)e.push('Conflicting inn serving state.');
    if(ordered&&(!integer(s.stats.innServiceSerial)||s.stats.innServiceSerial<1||s.room!==301||!s.flags.innSeated||!s.flags.shemaServing))e.push('Invalid pending inn service.');
  }
  if(record(s.quests)&&Object.values(s.quests).some(v=>typeof v!=='string'))e.push('Invalid quest stage.');
  if(!Array.isArray(s.spells)||s.spells.some((v:any)=>!text(v)))e.push('Invalid spell list.');
  else if(c)for(const spell of s.spells)if(!c.spells.some(x=>x.id===spell))e.push('Saved spell absent from this content revision: '+spell+'.');
  if(!Array.isArray(s.journal)||s.journal.some((v:any)=>typeof v!=='string'))e.push('Invalid journal.');
  if(typeof s.dead!=='boolean'||typeof s.won!=='boolean')e.push('Invalid completion state.');
  if(s.position!==undefined){const p=s.position;if(!record(p)||!integer(p.room)||!nonnegative(p.x)||!nonnegative(p.y)||p.x>1440||p.y>1080)e.push('Invalid saved hero position.');else if(c&&!c.rooms.some(r=>r.id===p.room))e.push('Saved position refers to a missing room.');}
  if(s.combat!==null){
    const f=s.combat;
    if(!record(f))e.push('Invalid combat state.');
    else{
      if(!text(f.id)||!text(f.name)||!nonnegative(f.health)||!nonnegative(f.maxHealth)||f.maxHealth<=0||f.health>f.maxHealth)e.push('Invalid combat identity or health.');
      for(const k of ['power','defense','reward','round','returnRoom'])if(!integer(f[k]))e.push('Invalid combat '+k+'.');
      if(c&&!c.encounters.some(x=>x.id===f.id))e.push('Unknown saved opponent.');
      if(c&&!c.rooms.some(x=>x.id===f.returnRoom))e.push('Combat return room is missing.');
      if(f.stamina!==undefined&&!nonnegative(f.stamina))e.push('Invalid opponent stamina.');
      if(f.heroStamina!==undefined&&(!nonnegative(f.heroStamina)||record(s.stats)&&f.heroStamina>s.stats.maxStamina))e.push('Invalid cached warrior stamina.');
      if(f.dazzleTicks!==undefined&&!integer(f.dazzleTicks))e.push('Invalid combat dazzle duration.');
      if(f.intent!==undefined&&!['guard','idle','windup','recover','dazzled'].includes(f.intent))e.push('Invalid opponent intent.');
      if(f.poseTicks!==undefined&&(!integer(f.poseTicks)||f.poseTicks<1||f.poseTicks>65535))e.push('Invalid opponent pose duration.');
      if(f.clock!==undefined){const k=f.clock;if(!record(k)||k.version!==1||k.enemyId!==f.id||k.room!==s.room||typeof k.paused!=='boolean'||!['normal','attack','parry','dodge'].includes(k.defense)||!['guard','idle','windup','recover','dazzled'].includes(k.phase))e.push('Invalid live combat clock.');else{for(const field of ['elapsedMs','enemyInMs','playerInMs','defenseInMs'])if(!nonnegative(k[field]))e.push('Invalid live combat timer '+field+'.');for(const field of ['enemyInMs','playerInMs','defenseInMs'])if(k[field]>60000)e.push('Live combat timer exceeds supported bound.');if(k.pendingSpell!==undefined){const p=k.pendingSpell;if(!record(p)||!['dazzleSpell','flameDartSpell'].includes(p.id)||!integer(p.power)||p.power<1||p.power>10000||!nonnegative(p.remainingMs)||p.remainingMs>60000||p.remainingMs>k.playerInMs)e.push('Invalid pending combat spell.');}}}
      if(f.randomEncounter!==undefined&&typeof f.randomEncounter!=='boolean')e.push('Invalid encounter marker.');
      if(f.sourceStats!==undefined){if(!record(f.sourceStats))e.push('Invalid combat statistics.');else for(const k of ['strength','intelligence','agility','vitality','luck','weaponUse','parry','dodge','armorValue','armorEnc','shieldValue','weaponValue'])if(!nonnegative(f.sourceStats[k]))e.push('Invalid combat statistic '+k+'.');}
    }
  }
  if(s.loot!==undefined){const loot=s.loot;if(!record(loot)||!integer(loot.silver)||!text(loot.id)||!text(loot.name))e.push('Invalid saved loot.');}
  if(s.minigame!==undefined){
    const g=s.minigame;
    if(!record(g))e.push('Invalid minigame state.');
    else{
      if(!['maze','darts'].includes(g.kind)||typeof g.active!=='boolean')e.push('Invalid minigame kind or activity.');
      for(const k of ['round','player','opponent'])if(!integer(g[k]))e.push('Invalid minigame '+k+'.');
      if(g.kind==='maze'){
        if(g.player>13||g.opponent>13)e.push('Invalid maze position.');
        if(!Array.isArray(g.obstacles))e.push('Missing maze obstacles.');
        else{const ids=new Set();for(const o of g.obstacles){if(!record(o)||!text(o.id)||!text(o.kind)||typeof o.cleared!=='boolean'||!nonnegative(o.x)||!nonnegative(o.y)||o.x>320||o.y>190)e.push('Invalid maze obstacle.');else{if(ids.has(o.id))e.push('Duplicate maze obstacle.');ids.add(o.id);}}}
        if(g.active&&s.room!==32)e.push('Active maze is outside its room.');
      }
      if(g.kind==='darts'){
        if(!integer(g.wager)||g.wager<1||g.wager>51||!integer(g.force)||g.force>11||!integer(g.angle)||g.angle>14||g.round>9||g.player>36||g.opponent>36)e.push('Invalid Dag-Nab-It controls or score.');
        if(!nonnegative(g.handX)||g.handX>320||!nonnegative(g.handY)||g.handY>240)e.push('Invalid Dag-Nab-It hand position.');
        if(g.active&&s.room!==340)e.push('Active Dag-Nab-It is outside its room.');
      }
    }
  }
  return e;
}
export function validateCampaign(c:Campaign):string[]{
  const e:string[]=[],rooms=new Set<number>(),items=new Set(c.items.map(x=>x.id)),spells=new Set(c.spells.map(x=>x.id)),rules=new Set<string>();
  if(items.size!==c.items.length)e.push('Duplicate item ID');if(spells.size!==c.spells.length)e.push('Duplicate spell ID');
  const checkCondition=(v:Condition|undefined,where:string)=>{if(!v)return;if(v.item&&!items.has(v.item))e.push('Unknown condition item '+v.item+' in '+where);if(v.spell&&!spells.has(v.spell))e.push('Unknown condition spell '+v.spell+' in '+where);for(const x of v.all||[])checkCondition(x,where);for(const x of v.any||[])checkCondition(x,where);if(v.not)checkCondition(v.not,where);};
  for(const r of c.rooms){if(rooms.has(r.id))e.push('Duplicate room '+r.id);rooms.add(r.id);}
  for(const r of c.rooms)for(const to of r.exits||[])if(!rooms.has(to))e.push(`Room ${r.id} has missing exit ${to}`);
  for(const r of c.rules){
    if(rules.has(r.id))e.push('Duplicate rule '+r.id);rules.add(r.id);for(const id of Array.isArray(r.room)?r.room:[r.room])if(!rooms.has(id))e.push('Rule '+r.id+' has missing room '+id);
    checkCondition(r.requires,r.id);checkCondition(r.unless,r.id);
    if(r.action.item&&!items.has(r.action.item)&&!spells.has(r.action.item))e.push('Unknown action item '+r.action.item+' in '+r.id);
    if(r.action.spell&&!spells.has(r.action.spell))e.push('Unknown action spell '+r.action.spell+' in '+r.id);
    for(const effect of r.effects){if(effect.item&&!items.has(effect.item))e.push('Unknown item '+effect.item+' in '+r.id);if(effect.room!==undefined&&!rooms.has(effect.room))e.push('Unknown effect room '+effect.room+' in '+r.id);if(effect.learn&&!spells.has(effect.learn))e.push('Unknown learned spell '+effect.learn+' in '+r.id);if(effect.combat&&!c.encounters.some(x=>x.id===effect.combat))e.push('Unknown encounter '+effect.combat+' in '+r.id);}
  }
  for(const g of c.gates||[]){if(!rooms.has(g.from)||!rooms.has(g.to))e.push('Gate has a missing room');checkCondition(g.requires,'gate '+g.from+'-'+g.to);}
  for(const shop of c.shops){if(!rooms.has(shop.room))e.push('Shop has a missing room '+shop.room);checkCondition(shop.when,'shop '+shop.room);for(const o of shop.items){if(!items.has(o.item)&&!spells.has(o.item))e.push('Shop has unknown item '+o.item);if(!Number.isFinite(o.price)||o.price<0)e.push('Invalid price for '+o.item);if(o.count!==undefined&&(!Number.isInteger(o.count)||o.count<1))e.push('Invalid bundle count for '+o.item);}}
  for(const room of c.rooms)if(room.encChance!==undefined&&(!Number.isFinite(room.encChance)||room.encChance<0||room.encChance>100))e.push('Invalid encounter chance in room '+room.id);
  if(c.wilderness){for(const s of c.wilderness.species){if(!c.encounters.some(e=>e.id===s.enemy))e.push('Unknown wilderness opponent '+s.enemy);if(s.lootMin<0||s.lootMax<s.lootMin)e.push('Invalid wilderness loot range '+s.enemy);}for(const arena of [...c.wilderness.byRoll,c.wilderness.fallback])if(!c.wilderness.species.some(s=>s.arena===arena))e.push('Missing wilderness species for arena '+arena);}
  return e;
}
