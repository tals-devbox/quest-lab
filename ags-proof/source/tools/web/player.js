'use strict';
const root='/home/web_user/saved_games';let statePath=null,inputPath=null,lastState='',saveWaiting=null,slotPath=null;
function report(type,data={}){parent.postMessage({type,...data},location.origin);}
function search(base,name,depth=0){if(depth>5)return null;try{for(const n of FS.readdir(base)){if(n==='.'||n==='..')continue;const p=base+'/'+n;const st=FS.stat(p);if(FS.isDir(st.mode)){const r=search(p,name,depth+1);if(r)return r;}else if(n===name)return p;}}catch{}return null;}
// Serialize sync requests. AGS's own async calls also pass through this queue.
function installSyncQueue(){const original=FS.syncfs.bind(FS);let busy=false,queue=[];FS.syncfs=(populate,callback)=>{queue.push({populate,callback});drain();};function drain(){if(busy||!queue.length)return;busy=true;const job=queue.shift();original(job.populate,e=>{busy=false;try{job.callback?.(e);}finally{drain();}});}}
function sync(){return new Promise((resolve,reject)=>FS.syncfs(false,e=>e?reject(e):resolve()));}
async function digest(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');}
const inputs=[];let pendingMode=null;const modes={'1':0,'2':1,'3':3,'4':2};
function pumpInput(){if(inputPath&&inputs.length&&!FS.analyzePath(inputPath).exists)FS.writeFile(inputPath,inputs.shift()+'\n');}
function key(key){if(!['1','2','3','4','t','s','l','i'].includes(key))throw Error('Unsupported input');if(key in modes){pendingMode=modes[key];canvas.style.pointerEvents='none';}inputs.push('@'+key);canvas.focus();pumpInput();}
function poll(){try{
 if(!statePath){statePath=search('/home/web_user','proof-state.json');if(statePath)inputPath=statePath.replace('proof-state.json','proof-input.txt');}
 if(statePath){pumpInput();const text=FS.readFile(statePath,{encoding:'utf8'}).trim();const s=JSON.parse(text);if(pendingMode!==null&&s.verb===pendingMode){pendingMode=null;canvas.style.pointerEvents='auto';}if(text!==lastState){lastState=text;report('state',{state:s});}
  if(saveWaiting&&s.serial>saveWaiting.serial){const waiter=saveWaiting;saveWaiting=null;sync().then(()=>report('saved',{serial:s.serial})).catch(e=>report('error',{message:'Save could not persist: '+e}));}
 }
 if(saveWaiting&&Date.now()-saveWaiting.started>10000){saveWaiting=null;report('error',{message:'Save timed out; no durable save confirmation.'});}
}catch(e){if(statePath)report('error',{message:'State bridge: '+e.message});}}
window.addEventListener('message',async e=>{if(e.source!==parent||e.origin!==location.origin||!inputPath)return;const d=e.data;try{
 if(d.type==='key')key(d.key);
 else if(d.type==='command'){if(typeof d.text!=='string'||d.text.length>200||/[\r\n\0@]/.test(d.text))throw Error('Invalid command');inputs.push(d.text);}
 else if(d.type==='save'){if(saveWaiting)throw Error('Save already pending');saveWaiting={serial:JSON.parse(lastState).serial,started:Date.now()};key('s');}
 else if(d.type==='export'){await sync();slotPath=search(root,'agssave.001');if(!slotPath)throw Error('Save a game first');const bytes=FS.readFile(slotPath);const envelope={format:'questlab-ags-proof-save',version:'0.1.0',sha256:await digest(bytes),data:btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))};report('export',{bytes:Array.from(new TextEncoder().encode(JSON.stringify(envelope)))});}
 else if(d.type==='import'){
  const envelope=JSON.parse(new TextDecoder().decode(new Uint8Array(d.bytes)));
  if(envelope.format!=='questlab-ags-proof-save'||envelope.version!=='0.1.0'||typeof envelope.data!=='string')throw Error('This proof requires a compatible 0.1.0 save export');
  const bytes=Uint8Array.from(atob(envelope.data),c=>c.charCodeAt(0));
  if(bytes.length<64||bytes.length>5*1024*1024||await digest(bytes)!==envelope.sha256)throw Error('Save integrity check failed');
  const head=new TextDecoder().decode(bytes.slice(0,80));if(!head.includes('Adventure Game Studio'))throw Error('Not an AGS save');
  slotPath=search(root,'agssave.001');if(!slotPath){const folders=FS.readdir(root).filter(n=>n!=='.'&&n!=='..'&&FS.isDir(FS.stat(root+'/'+n).mode));if(folders.length!==1)throw Error('Save once before importing');slotPath=root+'/'+folders[0]+'/agssave.001';}
  const previous=FS.analyzePath(slotPath).exists?FS.readFile(slotPath):null;
  FS.writeFile(slotPath+'.incoming',bytes);FS.rename(slotPath+'.incoming',slotPath);
  try{await sync();}catch(error){if(previous)FS.writeFile(slotPath,previous);throw error;}report('imported');
 }
}catch(error){report('error',{message:error.message});}});
var Module={noInitialRun:true,arguments:[],canvas:document.getElementById('canvas'),print:t=>console.log(t),printErr:t=>console.error(t),onAbort:e=>report('error',{message:'AGS stopped: '+e}),onRuntimeInitialized:async function(){try{
 installSyncQueue();FS.mkdirTree(root);FS.mount(IDBFS,{},root);await new Promise((resolve,reject)=>FS.syncfs(true,e=>e?reject(e):resolve()));
 for(const n of ['questlab-proof.ags','acsetup.cfg']){const r=await fetch(n);if(!r.ok)throw Error(n+' HTTP'+r.status);FS.writeFile('/'+n,new Uint8Array(await r.arrayBuffer()));}
 setInterval(poll,25);window.focus();canvas.focus();Module.callMain(['/questlab-proof.ags','--windowed']);
}catch(e){report('error',{message:e.message});document.querySelector('#error').textContent=e.message;}}};
