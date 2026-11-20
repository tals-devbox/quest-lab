import {validateCampaign,type Campaign} from './rules';
export interface ContentDocument {revision:number;overrides:Record<string,Record<string,any>>}
export function normalizedExits(exits:any[]):number[]{return [...new Set(exits.map(e=>typeof e==='number'?e:e?.to).filter(Number.isInteger))]}
export function mergeCampaign(base:Campaign,source:any,content:ContentDocument):Campaign{
 const c=structuredClone(base),o=content.overrides;
 for(const r of source.rooms||[])if(!c.rooms.some(x=>x.id===r.id))c.rooms.push({id:r.id,name:r.name,exits:normalizedExits((r.exits||[]).filter((e:any)=>e.kind==='room-property'||e.kind==='forest-region')),coverage:'imported'});
 for(const [id,patch]of Object.entries(o.rooms||{})){let r=c.rooms.find(r=>r.id===+id);if(!r){r={id:+id,name:patch.name||'New room',exits:[]};c.rooms.push(r)}Object.assign(r,patch,{id:+id});if(patch.exits)r.exits=normalizedExits(patch.exits);}
 for(const [id,patch]of Object.entries(o.items||{})){const i=c.items.find(i=>i.id===id);if(i)Object.assign(i,patch,{id});else c.items.push({id,name:patch.name||id,...patch});}
 for(const [id,patch]of Object.entries(o.spells||{})){const i=c.spells.find(i=>i.id===id);if(i)Object.assign(i,patch,{id});else c.spells.push({id,name:patch.name||id,cost:patch.cost??0,...patch});}
 for(const [id,patch]of Object.entries(o.quests||{})){const rule=c.rules.find(r=>r.id===id);if(patch.disabled){c.rules=c.rules.filter(r=>r.id!==id);continue}if(rule)Object.assign(rule,patch,{id});else c.rules.push({id,...patch} as any);}
 for(const [id,patch]of Object.entries(o.journal||{})){const q=c.quests.find(q=>q.id===id);if(q)Object.assign(q,patch,{id});else c.quests.push({id,title:patch.title||id,description:patch.description||'',...patch});}
 for(const rule of c.rules){const text=o.dialogue?.[rule.id];if(typeof text?.text==='string')rule.text=text.text;}
 return c;
}
const object=(v:any)=>!!v&&typeof v==='object'&&!Array.isArray(v);
const localURL=(v:any)=>typeof v==='string'&&v.startsWith('/')&&!v.startsWith('//')&&!v.includes('..');
export function validateContentDocument(doc:ContentDocument,source:any,base:Campaign):string[]{
 const errors:string[]=[];if(!object(doc?.overrides)||!Number.isInteger(doc.revision))return ['Invalid content document'];
 for(const [group,entries]of Object.entries(doc.overrides)){if(!object(entries)){errors.push('Invalid content group '+group);continue}for(const [id,value]of Object.entries(entries)){if(!/^[\w.:-]{1,160}$/.test(id)||['__proto__','constructor','prototype'].includes(id))errors.push('Invalid entity ID '+id);if(!object(value)){errors.push('Invalid entity '+id);continue}if(JSON.stringify(value).length>1000000)errors.push('Entity too large '+id);}}
 for(const [id,r]of Object.entries(doc.overrides.rooms||{})){
  if(!Number.isInteger(+id)||r.id!==undefined&&r.id!==+id)errors.push('Room ID mismatch '+id);
  if(r.exits!==undefined&&(!Array.isArray(r.exits)||r.exits.some((e:any)=>!Number.isInteger(typeof e==='number'?e:e?.to))))errors.push('Invalid exits '+id);
  if(r.entities!==undefined&&!Array.isArray(r.entities))errors.push('Invalid room entities '+id);
  if(r.polygons!==undefined&&!Array.isArray(r.polygons))errors.push('Invalid room polygons '+id);
  if(r.background!==undefined&&!localURL(r.background))errors.push('Background must be a local asset URL '+id);
 }
 for(const [id,r]of Object.entries(doc.overrides.quests||{})){
  if(r.disabled)continue;const prior=base.rules.find(x=>x.id===id),merged={...prior,...r};
  if(!Array.isArray(merged.effects)||!object(merged.action)||typeof merged.action.type!=='string'||typeof merged.text!=='string'||merged.room===undefined)errors.push('Incomplete quest rule '+id);
  for(const e of merged.effects||[])if(!object(e))errors.push('Invalid effect '+id);else for(const key of ['amount','score','silver','gold','increase','set','heal'])if(e[key]!==undefined&&!Number.isFinite(e[key]))errors.push('Invalid numeric effect '+id+'.'+key);
 }
 for(const [id,d]of Object.entries(doc.overrides.dialogue||{}))if(d.text!==undefined&&typeof d.text!=='string')errors.push('Invalid dialogue '+id);
 for(const [id,c]of Object.entries(doc.overrides.characters||{})){
  for(const key of ['image','spriteUrl'])if(c[key]!==undefined&&!localURL(c[key]))errors.push('Character image must be local '+id);
  if(c.appearance!==undefined){const a=c.appearance;if(!object(a)||!localURL(a.url)||!Number.isInteger(a.frameWidth)||!Number.isInteger(a.frameHeight)||a.frameWidth<=0||a.frameHeight<=0)errors.push('Invalid character appearance '+id);}
 }
 for(const [id,a]of Object.entries(doc.overrides.assets||{}))if(a.url!==undefined&&!localURL(a.url))errors.push('Asset URL must be local '+id);
 if(errors.length)return errors;
 try{errors.push(...validateCampaign(mergeCampaign(base,source,doc)))}catch(e){errors.push('Invalid content structure: '+(e as Error).message)}
 return errors;
}
