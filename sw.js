import {validateSave,mergeCampaign} from './public/build/server-contract.mjs';
const BASE=new URL(self.registration.scope).pathname, DB='quest-lab:'+BASE;
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{r.result.createObjectStore('files');r.result.createObjectStore('meta')};r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result)};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Close other Quest Lab tabs and retry.'))})}
async function read(store,key){const d=await db();try{return await new Promise((ok,no)=>{const r=d.transaction(store).objectStore(store).get(key);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}finally{d.close()}}
async function write(store,key,value){const d=await db();try{await new Promise((ok,no)=>{const t=d.transaction(store,'readwrite');t.objectStore(store).put(value,key);t.oncomplete=ok;t.onerror=()=>no(t.error);t.onabort=()=>no(t.error||Error('Storage transaction aborted'))})}finally{d.close()}}
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
function prefix(value){if(typeof value==='string')return /^\/(public|reference|data)\//.test(value)?BASE+value.slice(1):value;if(Array.isArray(value))return value.map(prefix);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,prefix(v)]));return value}
async function packed(path){const pack=await read('meta','pack');if(!pack)return;return read('files',pack.id+':'+path)}
async function packedJSON(path){const f=await packed(path);if(!f)throw Error('Missing game data: '+path);return JSON.parse(await f.blob.text())}
async function effective(){return mergeCampaign(await packedJSON('data/campaign.json'),await packedJSON('data/source-index.json'),await content())}
async function content(){return await packedJSON('content.snapshot.json')}
async function api(req,path,url){
 if(path==='api/pack-status')return json(await read('meta','pack')||null);
 if(path==='api/health')return json({app:'Quest Lab',mode:'static',storage:'device'});
 if(path==='api/content')return json(prefix(await content()));
 if(path==='api/resources')return json([]);
 if(path==='api/revisions')return json(await packedJSON('revisions.snapshot.json'));
 if(path==='api/source'){const s=await packedJSON('data/source-index.json');return json(prefix(url.searchParams.has('room')?s.rooms.find(r=>String(r.id)===url.searchParams.get('room'))||{}:s))}
 if(path==='api/save'){
  if(req.method==='GET')return json(await read('meta','save')||null);
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const text=await req.text();if(text.length>2e6)return json({error:'Save is too large'},413);
  const value=JSON.parse(text),errors=validateSave(value,await effective());if(errors.length)return json({error:'Invalid saved adventure',errors},400);
  await write('meta','save',value);return json({saved:true,storage:'device',at:new Date().toISOString()});
 }
 if(path==='api/capture'){if(req.method==='POST'){const text=await req.text();if(text.length>2e6)return json({error:'State is too large'},413);await write('meta','capture',JSON.parse(text))}return json({captured:true})}
 if(path==='api/state')return json(await read('meta','capture')||{});
 return json({error:'This published build is read-only. Ask Loom to publish a new revision.'},405);
}
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;const path=decodeURIComponent(url.pathname.slice(BASE.length));
 if(path.startsWith('api/')){e.respondWith(api(e.request,path,url).catch(err=>json({error:err.message},500)));return}
 if(path==='content.snapshot.json'||path==='revisions.snapshot.json'||path.startsWith('data/')||path.startsWith('reference/pictures/')||path.startsWith('reference/views/')||path.startsWith('reference/planes/')||path==='reference/asset-manifest.json'||path==='reference/status.json'||path==='reference/original-qfg1vga.zip'){
  e.respondWith((async()=>{const f=await packed(path);if(!f)return json({error:'Import your Quest Lab game-data pack on this device first.'},404);if(f.type==='application/json')return json(prefix(JSON.parse(await f.blob.text())));return new Response(f.blob,{headers:{'Content-Type':f.type,'Cache-Control':'no-store'}})})());
 }
});
