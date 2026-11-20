/** Original dispose-written visit flags, kept separate from native visited-on-entry. */
import audited from '../data/source-dispose-flags.json';
import type {Condition,GameState} from './rules';
export type SourceLifecycleState=Pick<GameState,'room'|'flags'>;
export const auditedSourceDisposeFlags:Readonly<Record<string,{room:number;sourceRefs:string[]}>>=audited.flags;
const rooms=[...new Set(Object.values(auditedSourceDisposeFlags).map(r=>r.room))];
const own=(value:object,key:string)=>Object.prototype.hasOwnProperty.call(value,key);
/** Mutates only afterState's source marker after an actual room-number change. */
export function applySourceRoomExit(beforeRoom:number,afterState:SourceLifecycleState):boolean{
 if(beforeRoom===afterState.room||!rooms.includes(beforeRoom))return false;
 const key='sourceDisposed:'+beforeRoom,changed=afterState.flags[key]!==true;
 afterState.flags[key]=true;return changed;
}
/** Leaves native visited:* and every unaudited source flag mapping intact. */
export function correctedSourceFlagMappings(base:Record<string,Condition>):Record<string,Condition>{
 const result=structuredClone(base);
 for(const [flag,r]of Object.entries(auditedSourceDisposeFlags))result[flag]={flag:'sourceDisposed:'+r.room};
 return result;
}
/** Conservative one-time inference per marker. An explicit false is authoritative.
 * Unknown current-room history becomes explicit false; never infer it from
 * introduced/NPC-presence/quest flags. Explicit markers make repeated calls
 * idempotent even after another room becomes current. Actual exits can set true.
 */
export function migrateSourceDisposedFlags(state:SourceLifecycleState):boolean{
 let changed=false;
 for(const room of rooms){const key='sourceDisposed:'+room;if(own(state.flags,key))continue;
  state.flags[key]=room!==state.room&&state.flags['visited:'+room]===true;changed=true;
 }
 return changed;
}
