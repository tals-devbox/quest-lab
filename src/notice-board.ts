export function noticeFor(entityId:string,messages:{noun:number;verb:number;condition:number;sequence:number;text:string}[]):string|undefined {
 const match=/^poster([1-6])$/.exec(entityId);if(!match)return;
 return messages.find(m=>m.noun===1&&m.verb===0&&m.condition===0&&m.sequence===Number(match[1]))?.text;
}
