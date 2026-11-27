/* Local, bounded game-session observations. No save files or package bytes. */
(() => {
  'use strict';
  const MAX_EVENTS=2000, MAX_TEXT=1000;
  const events=[];
  let dropped=0, pack=null, lastStateKey='', lastPosition=null, lastClickCount=null;
  const startedAt=new Date().toISOString();
  const text=(v,max=MAX_TEXT)=>typeof v==='string'?v.slice(0,max):'';
  const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
  const primitive=v=>typeof v==='boolean'?v:typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'?text(v,200):null;
  function fields(value,keys){const out={};if(!value||typeof value!=='object')return out;for(const k of keys)if(Object.hasOwn(value,k)){const v=primitive(value[k]);if(v!==null)out[k]=v;}return out;}
  function identity(manifest){if(!manifest||typeof manifest!=='object')return null;const item=Array.isArray(manifest.files)?manifest.files.find(f=>f&&f.name===manifest.game):null;return {id:text(manifest.id,64),version:text(manifest.version,64),edition:text(manifest.edition,64),engine:text(manifest.engine,64),gameSha256:text(item?.sha256||manifest.gameSha256,64)};}
  function add(type,detail){events.push({at:new Date().toISOString(),type,...detail});if(events.length>MAX_EVENTS){events.shift();dropped++;}}
  function stateSnapshot(s){
    const out={room:number(s.room),x:number(s.x),y:number(s.y),score:number(s.score),creating:primitive(s.creating),dead:primitive(s.dead),busy:primitive(s.busy),paused:primitive(s.paused),class:primitive(s.class),
      inventory:Array.isArray(s.inventory)?s.inventory.slice(0,64).map(i=>({id:number(i?.id),name:text(i?.name,160),amount:number(i?.amount)})):[],
      messages:Array.isArray(s.messages)?s.messages.slice(0,16).map(m=>({speaker:text(m?.speaker,100),text:text(m?.text)})):[{speaker:text(s.speaker,100),text:text(s.message)}],
      quest:fields(s.playtest?.quests,['ring','fruit']),mode:text(s.playtest?.mode,40),input:fields(s.input,['commandSequence','commandCompleted','gait']),
      town:fields(s.town,['registered','seated','meal','drink','thiefKnown','license','knifeRound','knifeScore']),
      barber:fields(s.barber,['mirror','docket','marketClue','vault','prize','basilAway','oiled','escaped']),
      goblin:fields(s.goblin,['prototype','active','phase','health','enemyHealth','stamina','blocks','dodges','hitsTaken','assisted','corpse','looted'])};
    return out;
  }
  function receive(e){
    const game=document.querySelector('#game');if(!game||e.origin!==location.origin||e.source!==game.contentWindow||!e.data||typeof e.data!=='object')return;
    const d=e.data;if(!['ready','state','saving','saved','error'].includes(d.type))return;
    if(d.type==='ready'){pack=identity(d.pack);lastStateKey='';lastPosition=null;lastClickCount=null;add('ready',{pack,hasSave:!!d.hasSave});return;}
    if(d.type==='state'){
      if(!d.state||typeof d.state!=='object')return;const s=d.state,input=s.input||{},clicks=number(input.clicks);
      if(clicks!==null&&lastClickCount!==null&&clicks>lastClickCount)add('scene-click',{count:clicks,x:number(input.x),y:number(input.y),code:number(input.code),blocked:primitive(input.blocked)});
      if(clicks!==null)lastClickCount=clicks;
      const snapshot=stateSnapshot(s),{x,y,...rest}=snapshot,key=JSON.stringify(rest),moved=lastPosition&&x!==null&&y!==null&&(Math.abs(x-lastPosition.x)>=8||Math.abs(y-lastPosition.y)>=8);
      if(key!==lastStateKey||!lastPosition||moved){add('state',{state:snapshot});lastStateKey=key;if(x!==null&&y!==null)lastPosition={x,y};}
      return;
    }
    add(d.type,{...(d.type==='saved'?{serial:number(d.serial),sha256:text(d.sha256,64)}:{}),...(d.type==='error'?{message:text(d.message)}:{})});
  }
  function mount(){
    const utility=document.querySelector('#utilities'),game=document.querySelector('#game');if(!utility||!game||document.querySelector('#session-trace-export'))return;
    const section=document.createElement('section'),title=document.createElement('h3'),explain=document.createElement('p'),exportButton=document.createElement('button'),panel=document.createElement('div'),label=document.createElement('label'),box=document.createElement('textarea'),copyButton=document.createElement('button'),copyStatus=document.createElement('p');
    title.textContent='Session log';explain.textContent='Commands, actions and game state stay in this tab until you export them. The log may contain story text.';
    exportButton.type='button';exportButton.id='session-trace-export';exportButton.textContent='Export session log';
    panel.hidden=true;label.htmlFor='session-trace-json';label.textContent='Session log JSON';box.id='session-trace-json';box.readOnly=true;box.rows=8;box.spellcheck=false;box.style.width='100%';
    copyButton.type='button';copyButton.textContent='Copy JSON';copyStatus.setAttribute('role','status');copyStatus.setAttribute('aria-live','polite');panel.append(label,box,copyButton,copyStatus);section.append(title,explain,exportButton,panel);utility.append(section);
    exportButton.addEventListener('click',()=>{
      const current=identity(window.questNative?.pack)||pack,output={format:1,kind:'questlab-session-log',startedAt,exportedAt:new Date().toISOString(),clientBuild:text(window.questNative?.clientBuild,64),pack:current,droppedEvents:dropped,events:events.slice()};
      const json=JSON.stringify(output,null,2);box.value=json;panel.hidden=false;copyStatus.textContent='';const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='questlab-session-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    copyButton.addEventListener('click',async()=>{try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(box.value);copyStatus.textContent='Copied.';}catch(_){box.focus();box.select();copyStatus.textContent='Selected. Copy using your browser or keyboard.';}});
  }
  window.addEventListener('message',receive);
  document.addEventListener('submit',e=>{if(e.target?.id!=='command-form')return;const command=text(document.querySelector('#command')?.value,200).trim();if(command)add('command',{command});},true);
  document.addEventListener('click',e=>{const target=e.target?.closest?.('button');if(!target||target.disabled||target.id==='session-trace-export')return;const adventure=document.querySelector('#adventure'),recovery=document.querySelector('#recovery-actions');if(!adventure?.contains(target)&&!recovery?.contains(target))return;add('action',{id:text(target.id,80),label:text(target.getAttribute('aria-label')||target.textContent,120),control:text(target.dataset?.control||target.dataset?.direction||target.dataset?.command,120)});},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
