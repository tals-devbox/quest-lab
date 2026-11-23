'use strict';
const frame=document.querySelector('#game'),q=s=>document.querySelector(s);let state=null,ready=false,pendingSave=false;
window.questProof={state:null,events:[],offline:false};
function send(type,data={}){frame.contentWindow.postMessage({type,...data},location.origin);}
function key(key){send('key',{key});}
for(const b of document.querySelectorAll('[data-key]'))b.onclick=()=>{key(b.dataset.key);if(b.dataset.key!=='i')for(const c of document.querySelectorAll('[data-key]'))c.setAttribute('aria-pressed',String(c===b));};
q('#mode').onclick=()=>key('t');q('#load').onclick=()=>key('l');q('#restart').onclick=()=>{ready=false;frame.src='player.html?fresh='+Date.now();};
q('#save').onclick=()=>{if(pendingSave)return;pendingSave=true;q('#save').disabled=true;q('#storage').textContent='Saving… keep this tab open.';send('save');};
q('#commandForm').onsubmit=e=>{e.preventDefault();const text=q('#command').value.trim();if(text){send('command',{text});q('#command').value='';}};
window.addEventListener('message',e=>{
 if(e.source!==frame.contentWindow||e.origin!==location.origin)return;
 const d=e.data;window.questProof.events.push({at:Date.now(),...d});if(window.questProof.events.length>150)window.questProof.events.shift();
 if(d.type==='state'){
  state=d.state;window.questProof.state=state;q('#message').textContent=state.message;
  q('#mode').disabled=false;q('#load').disabled=false;if(!pendingSave)q('#save').disabled=false;
  q('#commandForm').hidden=!state.typed;q('#verbs').hidden=!!state.typed;q('#mode').textContent=state.typed?'Switch to point & click':'Switch to typed';ready=true;
 }else if(d.type==='saved'){pendingSave=false;q('#save').disabled=false;q('#storage').textContent='Save confirmed on this browser · '+new Date().toLocaleTimeString();}
 else if(d.type==='error'){pendingSave=false;q('#save').disabled=!ready;q('#storage').textContent=d.message;}
 else if(d.type==='export'){const u=URL.createObjectURL(new Blob([new Uint8Array(d.bytes)],{type:'application/octet-stream'}));const a=document.createElement('a');a.href=u;a.download='QuestLab-AGS-Proof.agssave';a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);q('#backupStatus').textContent='Save exported.';}
 else if(d.type==='imported'){q('#backupStatus').textContent='Imported and persisted. Press Load to restore.';}
});
q('#export').onclick=()=>send('export');q('#import').onchange=async()=>{try{const f=q('#import').files[0];if(!f)return;if(f.size>5*1024*1024)throw Error('Save too large');send('import',{bytes:Array.from(new Uint8Array(await f.arrayBuffer()))});}catch(e){q('#backupStatus').textContent=e.message;}};
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js',{scope:'./'}).then(async r=>{
 await navigator.serviceWorker.ready;const controller=navigator.serviceWorker.controller||r.active;
 controller?.postMessage({type:'status'});
}).catch(e=>{q('#storage').textContent='Offline installation failed: '+e.message;});
navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='cached'){window.questProof.offline=true;if(!pendingSave)q('#storage').textContent='Offline package ready · saves stay on this browser';}});
