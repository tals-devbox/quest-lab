'use strict';
const canvas=document.querySelector('#canvas'),SAVE_ROOT='/home/web_user/saved_games',MAX_SAVE=20*1024*1024;
let manifest,identity,mountPoint,appdata,saveDir,statePath,inputPath,lastText='',state=null,saveWaiting=null,polling=false,started=false,hasSave=false;
const inputs=[];let inFlight=null,pendingMode=null,syncPending=0;
window.questNativePlayer={events:[],state:null,syncPending:0,queueLength:0,pack:null};
function report(type,data={}){const event={type,...data};parent.postMessage(event,location.origin);questNativePlayer.events.push({at:Date.now(),...event});if(questNativePlayer.events.length>100)questNativePlayer.events.shift();}
function fail(error){report('error',{message:error.message||String(error)});}
function exists(path){return FS.analyzePath(path).exists;}
function slot(){try{if(exists(saveDir+'/agssave.001'))return saveDir+'/agssave.001';const names=FS.readdir(saveDir).filter(n=>/^agssave\.001(?:\.[A-Za-z0-9_-]+)?$/.test(n)&&!/^agssave\.001\.(incoming|tmp|previous)$/.test(n));if(names.length>1)throw Error('More than one save slot matches.');return names.length?saveDir+'/'+names[0]:null;}catch(e){if(e.message==='More than one save slot matches.')throw e;return null;}}
function updatePointer(){canvas.style.pointerEvents=(!state||state.busy||state.creating||state.dead||pendingMode!==null||saveWaiting)?'none':'auto';}
function installSyncQueue(){
 const original=FS.syncfs.bind(FS),queue=[];let busy=false;
 FS.syncfs=(populate,callback)=>{queue.push({populate,callback});syncPending++;questNativePlayer.syncPending=syncPending;drain();};
 function drain(){if(busy||!queue.length)return;busy=true;const job=queue.shift();const done=error=>{busy=false;syncPending--;questNativePlayer.syncPending=syncPending;try{job.callback?.(error);}finally{drain();}};try{original(job.populate,done);}catch(e){done(e);}}
}
function sync(populate=false){return new Promise((resolve,reject)=>FS.syncfs(populate,e=>e?reject(e):resolve()));}
async function acquireSaveLock(key){
 const name='questlab-save:'+key,message='Already open in another tab—close it or return there.';
 if(navigator.locks?.request){
  await new Promise((resolve,reject)=>{navigator.locks.request(name,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock){reject(Error(message));return;}resolve();return new Promise(()=>{});}).catch(reject);});
  report('lock',{exclusive:true,mode:'web-lock'});return;
 }
 // Legacy browsers get an explicit single-tab limitation plus a best-effort lease guard.
 // localStorage has no compare-and-swap, so this is not advertised as full exclusion.
 const token=crypto.randomUUID?.()||Math.random().toString(36).slice(2),leaseKey='questlab-native-lease:'+key;
 const read=()=>{try{return JSON.parse(localStorage.getItem(leaseKey));}catch{return null;}};
 const prior=read();if(prior&&prior.expires>Date.now())throw Error(message);
 localStorage.setItem(leaseKey,JSON.stringify({token,expires:Date.now()+15000}));
 await new Promise(r=>setTimeout(r,200));if(read()?.token!==token)throw Error(message);
 const release=()=>{if(read()?.token===token)localStorage.removeItem(leaseKey);};
 addEventListener('pagehide',release,{once:true});
 setInterval(()=>{try{if(read()?.token!==token){report('lock-lost',{message:'Single-tab save lease was lost. This player has stopped to protect the save.'});location.replace('about:blank');return;}localStorage.setItem(leaseKey,JSON.stringify({token,expires:Date.now()+15000}));}catch{report('lock-lost',{message:'Single-tab save guard is unavailable. This player has stopped.'});location.replace('about:blank');}},3000);
 report('lock',{exclusive:false,mode:'lease-fallback',message:'Web Locks unavailable: single-tab fallback. Keep only one tab for this game open; full cross-tab exclusion is not guaranteed.'});
}
function allowedControl(text){return /^@pause:[01]$/.test(text)||/^@direction:[0-8]$/.test(text)||/^@playtest:[01]$/.test(text)||/^@consume:[0-9]{1,5}$/.test(text)||/^@ack:[0-9]{1,9}:[0-9]{1,3}$/.test(text)||/^@(walk|look|use|talk|dialog-close|begin|load)$/.test(text)||/^@(item|spell|topic|class|drop):[0-9]{1,5}$/.test(text)||/^@stat:[0-9]{2}:[0-3]$/.test(text)||(/^@name:[^\r\n\0]{0,40}$/.test(text));}
function focusScene(){canvas.focus({preventScroll:true});}
function enqueue(text){if(manifest?.edition!=='ega'&&/^@(walk|look|talk|use|item:|spell:|begin|load)/.test(text))focusScene();if(inputs.length>=64)throw Error('The input queue is full.');inputs.push(text);questNativePlayer.queueLength=inputs.length;const modes={'@walk':0,'@look':1,'@use':2,'@talk':3};if(text in modes)pendingMode=modes[text];if(text.startsWith('@item:'))pendingMode=5;if(text.startsWith('@spell:'))pendingMode=4;updatePointer();pump();}
// Route one real pointer gesture through the native input FIFO. AGS clears SDL's
// pending mouse events on focus gain, which otherwise loses activating clicks.
// Suppress compatibility mouse/touch events so a gesture cannot run twice.
function nativePointerEnabled(){return state?.input?.pointerProtocol===1&&Number.isInteger(state.input.screenWidth)&&Number.isInteger(state.input.screenHeight);}
window.addEventListener('pointerdown',e=>{
 if(e.target!==canvas||!nativePointerEnabled())return;e.preventDefault();e.stopImmediatePropagation();
 if(e.button!==0||!e.isPrimary||!state||state.busy||state.creating||state.dead||pendingMode!==null||saveWaiting)return;
 const r=canvas.getBoundingClientRect();if(r.width<=0||r.height<=0)return;
 const width=state.input.screenWidth,height=state.input.screenHeight;
 const x=Math.floor((e.clientX-r.left)*width/r.width),y=Math.floor((e.clientY-r.top)*height/r.height);
 if(x<0||y<0||x>=width||y>=height)return;
 focusScene();try{enqueue('@click:'+x+':'+y);}catch(error){fail(error);}
},{capture:true,passive:false});
for(const type of ['mousedown','mouseup','touchstart','touchend'])window.addEventListener(type,e=>{if(e.target===canvas&&nativePointerEnabled()){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,passive:false});
function pump(){if(!inputPath||!state||state.busy)return;if(inFlight){if(exists(inputPath))return;inFlight=null;}if(!inputs.length)return;const text=inputs.shift();questNativePlayer.queueLength=inputs.length;FS.writeFile(inputPath,text+'\n');inFlight={text,at:Date.now()};}
async function requestSave(){if(!state||state.creating||state.dead||state.busy)throw Error('Finish the current action before saving.');if(saveWaiting)throw Error('A save is already pending.');const path=slot(),before=path?await QuestPacks.sha256(FS.readFile(path)):null;saveWaiting={serial:state.serial,before,started:Date.now(),candidate:null,changedAt:0};report('saving');updatePointer();enqueue('@save');}
async function checkSave(){
 if(!saveWaiting)return;const wait=saveWaiting;if(Date.now()-wait.started>15000){saveWaiting=null;updatePointer();throw Error('Save timed out; no durable confirmation was issued.');}
 if(state.serial<=wait.serial)return;const path=slot();if(!path)return;
 const hash=await QuestPacks.sha256(FS.readFile(path));if(hash===wait.before)return;
 if(wait.candidate!==hash){wait.candidate=hash;wait.changedAt=Date.now();return;}
 if(Date.now()-wait.changedAt<100||state.busy)return;
 await sync();if(saveWaiting!==wait)return;
 if(await QuestPacks.sha256(FS.readFile(path))!==hash){wait.candidate=null;return;}
 saveWaiting=null;hasSave=true;updatePointer();if(manifest.edition!=='ega')focusScene();report('saved',{serial:state.serial,sha256:hash});
}
async function poll(){if(polling||!started)return;polling=true;try{
 if(exists(statePath)){
  const text=FS.readFile(statePath,{encoding:'utf8'}).trim();let next;try{next=JSON.parse(text);}catch{return;}
  if(!next||typeof next.serial!=='number'||typeof next.creating!=='number')throw Error('Native state report is incompatible.');state=next;questNativePlayer.state=state;
  if(pendingMode!==null&&state.verb===pendingMode)pendingMode=null;
  updatePointer();pump();
  if(text!==lastText){lastText=text;report('state',{state});}
  const present=!!slot();if(present!==hasSave){hasSave=present;report('storage',{hasSave});}
  await checkSave();
 }
}catch(e){if(saveWaiting){saveWaiting=null;updatePointer();}fail(e);}finally{polling=false;}}
function toBase64(bytes){const chunks=[];for(let i=0;i<bytes.length;i+=8192)chunks.push(String.fromCharCode(...bytes.subarray(i,i+8192)));return btoa(chunks.join(''));}
function sameIdentity(other){return QuestPacks.compatibleIdentity(other,identity);}
function ensureIdle(){if(!state||state.busy||saveWaiting||inputs.length||inFlight&&exists(inputPath))throw Error('Finish the current action before managing save files.');}
async function exportSave(){ensureIdle();await sync();const path=slot();if(!path)throw Error('Save this adventure first.');const bytes=FS.readFile(path);if(bytes.length>MAX_SAVE)throw Error('Native save exceeds the backup limit.');const envelope={format:'questlab-native-save',formatVersion:1,pack:identity,slot:1,name:path.split('/').pop(),bytes:bytes.length,sha256:await QuestPacks.sha256(bytes),data:toBase64(bytes)};const data=new TextEncoder().encode(JSON.stringify(envelope));report('export',{bytes:data.buffer,filename:manifest.id+'-'+manifest.version+'.qlsave'});}
async function importSave(raw){
 ensureIdle();const data=new Uint8Array(raw);if(data.length>30*1024*1024)throw Error('Backup exceeds 30 MB.');let envelope;try{envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));}catch{throw Error('Invalid save backup.');}
 if(envelope.format!=='questlab-native-save'||envelope.formatVersion!==1||envelope.slot!==1||!sameIdentity(envelope.pack))throw Error('This backup belongs to a different game or build.');
 if(typeof envelope.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(envelope.data)||!/^agssave\.001(?:\.[A-Za-z0-9_-]+)?$/.test(envelope.name))throw Error('Invalid native save envelope.');
 const bytes=Uint8Array.from(atob(envelope.data),c=>c.charCodeAt(0));if(bytes.length<64||bytes.length>MAX_SAVE||bytes.length!==envelope.bytes||await QuestPacks.sha256(bytes)!==envelope.sha256)throw Error('Save backup checksum failed.');
 if(!new TextDecoder().decode(bytes.subarray(0,100)).includes('Adventure Game Studio'))throw Error('The backup is not an AGS native save.');
 const existing=slot();if(existing&&existing.split('/').pop()!==envelope.name)throw Error('Backup filename does not match this game slot.');if(!existing&&envelope.name!=='agssave.001')throw Error('Save once before importing a custom-named native backup.');
 const path=saveDir+'/'+envelope.name,previous=exists(path)?FS.readFile(path):null;
 FS.writeFile(path+'.incoming',bytes);FS.rename(path+'.incoming',path);
 try{await sync();}catch(e){if(previous)FS.writeFile(path,previous);else FS.unlink(path);try{await sync();}catch{}throw Error('Import did not persist; previous save restored in memory.');}
 hasSave=true;report('imported',{hasSave:true});
}
window.addEventListener('message',async e=>{if(e.source!==parent||e.origin!==location.origin||!state||!e.data||typeof e.data.type!=='string')return;const d=e.data;try{
 if(d.type==='focus'){focusScene();}
 else if(d.type==='control'){if(typeof d.text!=='string'||!allowedControl(d.text))throw Error('Unsupported host control.');if(state.busy&&!d.text.startsWith('@ack:'))throw Error('The adventure is finishing its current action.');enqueue(d.text);}
 else if(d.type==='command'){if(typeof d.text!=='string'||!d.text.trim()||d.text.length>200||/[\r\n\0@]/.test(d.text))throw Error('Invalid adventure command.');if(state.creating||state.dead||state.busy)throw Error('Commands are unavailable right now.');enqueue(d.text);}
 else if(d.type==='save')await requestSave();
 else if(d.type==='export')await exportSave();else if(d.type==='import')await importSave(d.bytes);
}catch(error){fail(error);}});
window.addEventListener('keydown',e=>{if(e.key==='F5'||e.key==='F7'){e.preventDefault();e.stopImmediatePropagation();if(e.key==='F5')requestSave().catch(fail);else if(hasSave)enqueue('@load');}},true);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&started)sync().catch(fail);});
const nativeLogTail=[];
function engineLine(text,isError=false){const line=String(text);nativeLogTail.push(line.slice(0,500));if(nativeLogTail.length>12)nativeLogTail.shift();(isError?console.error:console.log)(line);if(/corrupt|decompression failed|bad compressed data/i.test(line)){const detail='Native resource error · '+(manifest?.edition||'game')+' '+(manifest?.version||'')+' · room '+(state?.room??'loading')+': '+line;document.querySelector('#error').textContent=detail;fail(Error(detail));}}
var Module={noInitialRun:true,arguments:[],canvas,print:t=>engineLine(t),printErr:t=>engineLine(t,true),onExit:code=>{if(code!==0){const detail='AGS exited ('+code+') · '+nativeLogTail.slice(-4).join(' | ');document.querySelector('#error').textContent=detail;fail(Error(detail));}},onAbort:e=>{document.querySelector('#error').textContent='AGS stopped: '+e;fail(Error('AGS stopped: '+e));},onRuntimeInitialized:async function(){try{
 const id=new URL(location.href).searchParams.get('pack')||await QuestPacks.selected();if(!id)throw Error('Install and choose a game package first.');const record=await QuestPacks.get(id),pack=await QuestPacks.parsePack(await record.blob.arrayBuffer());manifest=pack.manifest;identity=QuestPacks.identity(manifest);questNativePlayer.pack=identity;
 const key=QuestPacks.storageKey(manifest);await acquireSaveLock(key);mountPoint=SAVE_ROOT+'/'+key;appdata=mountPoint+'/appdata';saveDir=mountPoint+'/saves';statePath=appdata+'/quest-state.json';inputPath=appdata+'/quest-input.txt';
 installSyncQueue();FS.mkdirTree(mountPoint);FS.mount(IDBFS,{},mountPoint);await sync(true);FS.mkdirTree(appdata);FS.mkdirTree(saveDir);
 for(const path of [statePath,inputPath])if(exists(path))FS.unlink(path);
 for(const file of pack.files)FS.writeFile('/'+file.name,file.data);
 hasSave=!!slot();report('ready',{pack:manifest,bytes:record.bytes,hasSave});started=true;setInterval(poll,40);canvas.focus();
 Module.callMain(['/'+manifest.game,'--windowed','--background','--no-message-box','--localuserconf','--shared-data-dir',appdata,'--user-data-dir',saveDir]);
}catch(e){document.querySelector('#error').textContent=e.message;fail(e);}}};

const directionKeys={ArrowUp:1,ArrowRight:3,ArrowDown:5,ArrowLeft:7,Numpad8:1,Numpad9:2,Numpad6:3,Numpad3:4,Numpad2:5,Numpad1:6,Numpad4:7,Numpad7:8,Numpad5:0,Escape:0};
window.addEventListener('keydown',e=>{if(!state?.playtest||state.creating||state.dead||e.ctrlKey||e.altKey||e.metaKey||e.isComposing||e.target.closest?.('input,textarea,select,[contenteditable=true]'))return;const d=directionKeys[e.code]??directionKeys[e.key];if(d===undefined)return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat&&!state.busy&&!saveWaiting)try{enqueue('@direction:'+d);}catch(error){fail(error);}},true);
