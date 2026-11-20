/** A read-only projection of stateless SCI feedback. Never executes SCI or mutates gameplay. */
import {isNight,meets,type Condition,type GameState} from './rules';
const UNKNOWN=Symbol('unknown');
type Value=number|boolean|typeof UNKNOWN;
const statNames=['strength','intelligence','agility','vitality','luck','weaponUse','parry','dodge','stealth','pickLocks','throwing','climbing','magic','experience','health','stamina','mana'];
export interface SourceFeedback {texts:string[];sourceRefs:string[];kind:'source-stateless-response'}
export function sourceFeedback(state:GameState,entity:any,verb:number,module:number,resources:Record<string,any[]>,inventory:any[],flags:Record<string,Condition>={}):SourceFeedback|null{
 const branch=entity.interactions?.find((i:any)=>i.verb===verb);if(!branch?.ast)return null;
 const phase=state.minutes>=1380?6:state.minutes>=1200?5:state.minutes>=1020?4:state.minutes>=840?3:state.minutes>=660?2:state.minutes>=480?1:state.minutes>=300?0:state.minutes>=120?7:6;
 function value(x:any):Value{
  if(typeof x==='number'||typeof x==='boolean')return x;
  if(x==='gNight')return isNight(state)?1:0;if(x==='gTimeOfDay')return phase;if(x==='gCurRoomNum')return state.room;if(x==='gClock')return state.minutes*2.5;if(x==='theVerb')return verb;
  if(x?.$array?.[0]==='gEgoStats'){const name=statNames[x.$array[1]];return name?state.stats[name]??0:UNKNOWN}
  if(!Array.isArray(x))return UNKNOWN;
  const [op,...args]=x;
  if(op==='IsFlag'){const condition=flags[String(args[0])];return condition?meets(state,condition)?1:0:UNKNOWN}
  if(op==='gEgo'&&args[0]==='has:'){const item=inventory.find((i:any)=>i.sciIndex===args[1]);return item?state.inventory[item.id]||0:UNKNOWN}
  if(op==='self'&&typeof args[0]==='string'&&args[0].endsWith(':')){const result=entity.properties?.[args[0].slice(0,-1)];return typeof result==='number'?result:UNKNOWN}
  if(op==='not'){const a=value(args[0]);return a===UNKNOWN?UNKNOWN:!a}
  if(op==='and'||op==='or'){const list=args.map(value);if(op==='and'){if(list.some(v=>v!==UNKNOWN&&!v))return false;return list.includes(UNKNOWN)?UNKNOWN:true}if(list.some(v=>v!==UNKNOWN&&!!v))return true;return list.includes(UNKNOWN)?UNKNOWN:false}
  if(op==='OneOf'){const list=args.map(value);if(list.includes(UNKNOWN))return UNKNOWN;return list.slice(1).includes(list[0])}
  const list=args.map(value);if(list.includes(UNKNOWN))return UNKNOWN;const nums=list.map(Number);
  if(op==='==')return nums.every(n=>n===nums[0]);if(op==='!=')return nums[0]!==nums[1];
  if(['<','>','<=','>='].includes(op))return nums.slice(1).every((n,i)=>op==='<'?nums[i]<n:op==='>'?nums[i]>n:op==='<='?nums[i]<=n:nums[i]>=n);
  if(op==='+')return nums.reduce((a,b)=>a+b,0);if(op==='-')return nums[0]-nums[1];if(op==='*')return nums.reduce((a,b)=>a*b,1);
  return UNKNOWN;
 }
 const texts:string[]=[],refs:string[]=[];
 function execute(x:any):boolean{
  if(!Array.isArray(x))return true;
  const [op,...args]=x;
  if(op==='if'){const condition=value(args[0]);if(condition===UNKNOWN)return false;const otherwise=args.indexOf('else');const selected=condition?(otherwise<0?args.slice(1):args.slice(1,otherwise)):otherwise<0?[]:args.slice(otherwise+1);return selected.every(execute)}
  if(op==='cond'){for(const arm of args){if(!Array.isArray(arm))return false;const condition=arm[0]==='else'?true:value(arm[0]);if(condition===UNKNOWN)return false;if(condition)return arm.slice(1).every(execute)}return true}
  if(op==='switch'){const subject=value(args[0]);if(subject===UNKNOWN)return false;for(const arm of args.slice(1)){if(!Array.isArray(arm))return false;if(arm[0]==='else'||value(arm[0])===subject)return arm.slice(1).every(execute)}return true}
  if(op==='gMessager'&&args[0]==='say:'){
   const noun=value(args[1]),v=args[2]===undefined?0:value(args[2]),condition=args[3]===undefined?0:value(args[3]),sequence=args[4]===undefined||args[4]===0?1:value(args[4]);
   const resource=args[6]===undefined?module:value(args[6]);if([noun,v,condition,sequence,resource].includes(UNKNOWN))return false;
   const oneOnly=args[4]!==undefined&&value(args[4])!==0;let found=false;
   for(let seq=Number(sequence),guard=0;guard<100;seq++,guard++){const message=resources[String(resource)]?.find(m=>m.noun===noun&&m.verb===v&&m.condition===condition&&m.sequence===seq);if(!message?.text)break;if(/%[sd]/.test(message.text))return false;texts.push(message.text);refs.push('message:'+String(resource)+':'+String(noun)+':'+String(v)+':'+String(condition)+':'+String(seq));found=true;if(oneOnly)break;}return found;
  }
  if(op==='return'){if(args.length&&Array.isArray(args[0]))return execute(args[0]);return true}
  // A write, motion, script, random call or unsupported kernel cannot become pretend success.
  return false;
 }
 if(!branch.ast.slice(1).every(execute)||!texts.length)return null;
 return {texts,sourceRefs:[branch.sourceRef,...refs],kind:'source-stateless-response'};
}
