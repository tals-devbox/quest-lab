/** Dialogue schedules can constrain speakers without proving that every
 * conversation-progress flag controls whether the actor is physically there. */
export function hasSchedule(value:unknown):boolean {
  return !!value&&typeof value==='object'&&('night' in value||Object.values(value).some(hasSchedule));
}

/** Keep existing presence conditions, except where an earned story action must
 * first interact with the actor to set the very flag on its dialogue record. */
export function shouldApplyDialoguePresence(room:number,entityId:string,when:unknown):boolean {
  if(!when)return false;
  const singleFlag=typeof when==='object'&&Object.keys(when).length===1?(when as {flag?:unknown}).flag:undefined;
  return !(room===73&&['bruno','brutus'].includes(entityId)&&singleFlag==='brigandPassword'||room===96&&entityId==='yorick'&&singleFlag==='yorickMet');
}
