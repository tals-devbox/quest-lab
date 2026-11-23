(function(global){
'use strict';
const MAX_PACK=100*1024*1024,MAX_MANIFEST=64*1024,ENGINE='AGS3.6.3.17',MAGIC='QLAGS1\n',DB='questlab-native-packs-v1';
const idPattern=/^[a-z0-9][a-z0-9._-]{0,63}$/;
function check(ok,message){if(!ok)throw Error(message);}
function bytesOf(data){if(data instanceof ArrayBuffer)return new Uint8Array(data);if(ArrayBuffer.isView(data))return new Uint8Array(data.buffer,data.byteOffset,data.byteLength);throw Error('Expected binary package');}
async function sha256(data){check(global.crypto?.subtle,'Secure browser storage requires HTTPS or localhost.');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytesOf(data))),b=>b.toString(16).padStart(2,'0')).join('');}
function validateManifest(m){
 check(m&&m.format===1&&m.engine===ENGINE,'Unsupported package format or engine.');
 check(typeof m.id==='string'&&idPattern.test(m.id),'Invalid game identity.');
 check(typeof m.version==='string'&&/^[A-Za-z0-9._+-]{1,64}$/.test(m.version),'Invalid package version.');
 check(typeof m.edition==='string'&&idPattern.test(m.edition),'Invalid edition.');
 check(typeof m.title==='string'&&m.title.trim().length>0&&m.title.length<=120&&!/[\0\r\n]/.test(m.title),'Invalid game title.');
 check(typeof m.game==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.ags$/.test(m.game),'Invalid native game filename.');
 check(Array.isArray(m.files)&&m.files.length===2,'Package must contain exactly the native .ags and acsetup.cfg.');
 const names=new Set();let total=0;
 for(const f of m.files){check(f&&[m.game,'acsetup.cfg'].includes(f.name)&&!names.has(f.name),'Invalid or duplicate package filename.');names.add(f.name);check(Number.isSafeInteger(f.bytes)&&f.bytes>0&&f.bytes<=MAX_PACK,'Invalid package file size.');check(typeof f.sha256==='string'&&/^[0-9a-f]{64}$/.test(f.sha256),'Invalid SHA-256 checksum.');if(f.name==='acsetup.cfg')check(f.bytes<=65536,'Native configuration is too large.');total+=f.bytes;}
 check(names.has(m.game)&&names.has('acsetup.cfg')&&total<=MAX_PACK,'Incomplete or oversized package.');return total;
}
async function parsePack(data){
 const all=bytesOf(data);check(all.byteLength<=MAX_PACK&&all.byteLength>=13,'Package is empty or exceeds 100 MB.');
 check(new TextDecoder().decode(all.subarray(0,7))===MAGIC,'This is not a QLAGS1 game package.');
 const length=new DataView(all.buffer,all.byteOffset,all.byteLength).getUint32(7,true);check(length>0&&length<=MAX_MANIFEST&&11+length<=all.length,'Invalid package manifest length.');
 let manifest;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all.subarray(11,11+length)));}catch{throw Error('Invalid UTF-8 package manifest.');}
 const payload=validateManifest(manifest);check(11+length+payload===all.length,'Package is truncated or has trailing data.');
 let offset=11+length;const files=[];for(const f of manifest.files){const bytes=all.subarray(offset,offset+f.bytes);check(await sha256(bytes)===f.sha256,'Package checksum failed: '+f.name);files.push({...f,data:bytes});offset+=f.bytes;}
 return {manifest,files,bytes:all.byteLength};
}
function database(){return new Promise((resolve,reject)=>{check(global.indexedDB,'IndexedDB is not available in this browser.');const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{r.result.createObjectStore('packs',{keyPath:'id'});r.result.createObjectStore('meta',{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Close other Quest Lab tabs to finish opening storage.'));});}
async function transaction(stores,mode,work){const db=await database();return new Promise((resolve,reject)=>{let value;const tx=db.transaction(stores,mode);tx.oncomplete=()=>{db.close();resolve(value);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||Error('Storage transaction did not complete.'));};try{value=work(tx);}catch(e){tx.abort();db.close();reject(e);}});}
async function install(data){const raw=bytesOf(data),parsed=await parsePack(raw);const record={id:parsed.manifest.id,manifest:parsed.manifest,blob:new Blob([raw],{type:'application/x-qlags'}),bytes:raw.length,installedAt:new Date().toISOString()};
 // All names, sizes, bounds and hashes are checked before opening the write transaction.
 await transaction(['packs','meta'],'readwrite',tx=>{tx.objectStore('packs').put(record);tx.objectStore('meta').put({key:'selected',value:record.id});});return record;
}
async function request(store,key){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();reject(tx.error);};});}
async function list(){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('packs','readonly'),r=tx.objectStore('packs').getAll();r.onsuccess=()=>resolve(r.result.map(({id,manifest,bytes,installedAt})=>({id,manifest,bytes,installedAt})));r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();});}
async function select(id){check(typeof id==='string'&&idPattern.test(id),'Invalid selection.');check(await request('packs',id),'Install this game first.');await transaction(['meta'],'readwrite',tx=>tx.objectStore('meta').put({key:'selected',value:id}));}
async function selected(){return (await request('meta','selected'))?.value||null;}
async function get(id){const record=await request('packs',id);check(record,'The selected game is not installed in this browser.');return record;}
function identity(m){return {id:m.id,version:m.version,engine:m.engine,edition:m.edition,gameSha256:m.files.find(f=>f.name===m.game).sha256};}
function compatibleIdentity(a,b){return !!a&&!!b&&['id','version','engine','edition','gameSha256'].every(k=>a[k]===b[k]);}
function storageKey(m){return m.id+'/'+m.version+'/'+identity(m).gameSha256.slice(0,20);}
global.QuestPacks={MAX_PACK,MAX_MANIFEST,ENGINE,MAGIC,parsePack,validateManifest,sha256,install,list,select,selected,get,identity,compatibleIdentity,storageKey};
})(globalThis);
