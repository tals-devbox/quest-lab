/** Read-only original SCI conversations. Quest effects require explicit reducer actions. */
import {meets, type Action, type Condition, type GameState} from './rules';

export interface DialogueLine {
  text:string; talker:number; speaker:string; portraitView?:number;
  source:{module:number;noun:number;verb:number;condition:number;sequence:number};
}
export interface DialogueTopic {
  id:string; query?:number; label:string; path:string[]; lines:DialogueLine[];
  menuEntries?:{path:string[];query?:number;menuArray?:string;order?:number;branch?:boolean;when?:Condition;status:string;sourceRefs:string[]}[];
  when?:Condition; status:'baseline'|'conditional'|'unsupported';
  sourceRefs:string[]; unresolved:string[]; nativeAction?:Action;
  afterRuleIds?:string[];
}
export interface DialogueCharacter {
  id:string; room:number; entityId:string; aliases:string[]; name:string; noun:number|null;
  sourceTalkers:string[]; portraitView:number|null; look:DialogueLine[];
  topics:DialogueTopic[]; unsupported:{id:string;label:string;reason:string}[];
  sourceRefs:string[]; when?:Condition;
}
export interface DialogueData {
  schemaVersion:1; characters:DialogueCharacter[];
  sourceFlags?:Record<string,Condition>;
  afterRules?:Record<string,{characterId:string;topicId:string}[]>;
  sourceTalkers:{id:string;module:number;sourceRef:string;characterIds:string[];supportedTopics:number}[];
  summary:Record<string,number>; limits:string[];
}
export interface DialogueReading {
  characterId:string; topicId:string; label:string; lines:DialogueLine[];
  nativeAction?:Action; sourceRefs:string[];
}

/** Only characters present in this room and whose reliable source gate is satisfied. */
export function charactersInRoom(state:GameState,data:DialogueData):DialogueCharacter[]{
  return data.characters.filter(c=>c.room===state.room&&meets(state,c.when));
}
function character(state:GameState,data:DialogueData,id:string){
  const key=id.toLowerCase();
  return charactersInRoom(state,data).find(c=>c.id.toLowerCase()===key||c.entityId.toLowerCase()===key||c.aliases.some(a=>a.toLowerCase()===key));
}
/** Unknown source predicates are deliberately hidden; they are never assumed true. */
export function topicsFor(state:GameState,data:DialogueData,characterId:string):DialogueTopic[]{
  const c=character(state,data,characterId);
  return c?.topics.filter(t=>t.status!=='unsupported'&&(t.lines.length>0||t.menuEntries?.some(e=>e.branch))&&meets(state,t.when))||[];
}
/** Returns undefined for unknown, unavailable or withheld topics. Does not mutate state. */
export function readTopic(state:GameState,data:DialogueData,characterId:string,topicId:string):DialogueReading|undefined {
  const c=character(state,data,characterId);
  const t=c&&topicsFor(state,data,c.id).find(t=>t.id===topicId);
  if(!c||!t)return undefined;
  return {characterId:c.id,topicId:t.id,label:t.label,lines:t.lines.map(l=>({...l,source:{...l.source}})),sourceRefs:[...t.sourceRefs],...(t.nativeAction?{nativeAction:{...t.nativeAction}}:{})};
}
/** Scripted speech attached to a just-applied rule, including a speaker who departs.
 * Only the generator's explicit episode index bypasses ordinary NPC visibility. */
export function readAfterRules(state:GameState,data:DialogueData,ruleIds:readonly string[]):DialogueReading[]{
  const readings:DialogueReading[]=[],seen=new Set<string>();
  for(const ruleId of ruleIds)for(const ref of data.afterRules?.[ruleId]||[]){
    const key=ref.characterId+':'+ref.topicId;if(seen.has(key))continue;seen.add(key);
    const c=data.characters.find(c=>c.id===ref.characterId&&c.room===state.room);
    const t=c?.topics.find(t=>t.id===ref.topicId&&t.afterRuleIds?.includes(ruleId));
    if(!c||!t||t.status==='unsupported'||!t.lines.length||!meets(state,t.when))continue;
    readings.push({characterId:c.id,topicId:t.id,label:t.label,lines:t.lines.map(l=>({...l,source:{...l.source}})),sourceRefs:[...t.sourceRefs]});
  }
  return readings;
}
/** Exact unconditional source Look text only; no unrelated resource rows as fallback. */
export function lookAt(state:GameState,data:DialogueData,characterId:string):DialogueLine[]{
  return (character(state,data,characterId)?.look||[]).map(l=>({...l,source:{...l.source}}));
}
