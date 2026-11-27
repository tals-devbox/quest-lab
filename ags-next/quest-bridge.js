'use strict';
let questViewerReady=false,questViewerGeneration=0,questViewerLoadedId='',questViewerPending=null;
function questViewerRestoreSelection(select){select.value=questViewerLoadedId;if(select.value!==questViewerLoadedId)select.value='';}
async function refreshQuestViewer(){
 const select=document.querySelector('#quest-pack'),status=document.querySelector('#quest-viewer-status');
 if(!select||questViewerPending)return;
 const generation=++questViewerGeneration,requested=select.value||window.questNative?.pack?.id||'';
 questViewerPending=null;
 try{
  const records=await QuestPacks.list();
  if(generation!==questViewerGeneration)return;
  const selected=requested||await QuestPacks.selected();
  if(generation!==questViewerGeneration)return;
  select.replaceChildren(new Option('No quest data selected',''));
  for(const record of records)select.append(new Option(`${record.manifest.title} · ${record.manifest.version}`,record.id));
  if(!records.length){questViewerLoadedId='';status.textContent='Install a game pack from Home to see its quests. Your comments remain available in the viewer.';return;}
  const target=records.some(r=>r.id===selected)?selected:records[0].id;
  select.value=target;
  const data=await QuestPacks.questData(target);
  if(generation!==questViewerGeneration)return;
  if(!questViewerReady){status.textContent='Waiting for the quest viewer…';return;}
  questViewerPending={requestId:generation,id:target,hasData:!!data};select.disabled=true;
  status.textContent='Opening quest data…';
  document.querySelector('#quest-viewer').contentWindow.postMessage({type:'questlab:quest-data',requestId:generation,data:data||{format:1,contentVersion:target,quests:[]}},location.origin);
 }catch(error){if(generation!==questViewerGeneration)return;questViewerRestoreSelection(select);status.textContent='Could not read quest data: '+error.message+'. Previous quest data remains open.';}
}
document.querySelector('#quest-pack').addEventListener('change',refreshQuestViewer);
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==document.querySelector('#quest-viewer').contentWindow)return;
 if(event.data?.type==='questlab:quest-viewer-ready'){questViewerReady=true;questViewerPending=null;questViewerLoadedId='';document.querySelector('#quest-pack').disabled=false;refreshQuestViewer();return;}
 if(event.data?.type==='questlab:quest-data-file-opened'){questViewerLoadedId='';document.querySelector('#quest-pack').value='';document.querySelector('#quest-viewer-status').textContent='Showing a locally opened quest data file; no game pack is selected.';return;}
 if(event.data?.type!=='questlab:quest-data-result'||!questViewerPending||event.data.requestId!==questViewerPending.requestId)return;
 const pending=questViewerPending;questViewerPending=null;
 const select=document.querySelector('#quest-pack'),status=document.querySelector('#quest-viewer-status');select.disabled=false;
 if(event.data.accepted===true){questViewerLoadedId=pending.id;select.value=pending.id;status.textContent=pending.hasData?'Comments stay in this browser. Export them before changing devices.':'This older pack has no quest catalogue. Install the current EGA pack to explore its quests. Your comments are retained.';}
 else{questViewerRestoreSelection(select);status.textContent=(event.data.reason||'Quest data was not opened.')+' Previous quest data remains open.';}
});
