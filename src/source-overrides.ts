/** Source resource overlays only. No program, quest, geometry or save mutation.
 * Always call with the preserved imported base, not a preceding effective copy.
 * Pending text/Print continuations retain their captured transcript; reread the
 * message to observe replacement text. Hosts should defer replacing resources
 * used by an open replayable Print dialog until its response has completed.
 * Source byte buffers currently require Latin-1; native remake text is separate.
 */
export interface SourceMessageResource {noun:number;verb:number;condition:number;sequence:number;text:string;[key:string]:unknown}
export interface SourceCelResource {url:string;width:number;height:number;x:number;y:number;[key:string]:unknown}
export interface SourceLoopResource {mirrorOf:number|null;cels:SourceCelResource[];[key:string]:unknown}
export interface SourceViewResource {loops:SourceLoopResource[];[key:string]:unknown}
export interface SourceOverlayResources {messages:Record<string,SourceMessageResource[]>;views:Record<string,SourceViewResource>;sourceCelOverrides?:Record<string,string>;sourceContentRevision?:number}
export interface SourceOverrideContent {revision:number;overrides:Record<string,unknown>}
export interface SourceOverrideDiagnostic {severity:'error';code:string;key?:string;message:string}
export interface SourceOverrideResult<T extends SourceOverlayResources> {
  ok:boolean;resources:T;diagnostics:SourceOverrideDiagnostic[];contentRevision:number;requestedRevision:number|null;
  savesCompatible:true;compatibilityScope:'source-message-text-and-cel-url-only';
  changes:{messages:string[];cels:string[]};limits:readonly string[];
}
const limits=[
  'Only existing source message text and cel URLs are editable here; source scripts, quests, rewards and gameplay remain unchanged.',
  'Pending messages retain captured old text. Reread after editing; defer resource replacement while a replayable Print dialog is open.',
  'Source byte-buffer text requires Latin-1 and exact original formatter tokens. Native remake Unicode text is a separate pathway.',
  'Sprite dimensions, offsets, mirror metadata and collision data stay original. URL existence, image decoding and visual alignment require host validation.',
  'Save state and program hashes do not change. Existing pending transcript/continuation handling remains host-owned.',
] as const;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
function numbers(key:string,count:number,max:number[]):number[]|null {
  const p=key.split(':');if(p.length!==count||p.some((v,i)=>!/^(0|[1-9][0-9]*)$/.test(v)||!Number.isSafeInteger(+v)||+v>max[i]))return null;return p.map(Number);
}
/** Root-local URLs only, including checking encoded traversal before URL normalization. */
export function isLocalSourceAssetURL(value:unknown):value is string {
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(value))return false;
  let pathname=value.split(/[?#]/,1)[0];
  try{for(let i=0;i<5;i++){const decoded=decodeURIComponent(pathname);if(decoded===pathname)break;pathname=decoded;if(i===4)return false;}}
  catch{return false;}
  if(pathname.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(pathname)||pathname.split('/').some(p=>p==='.'||p==='..'))return false;
  try{return new URL(value,'http://quest-lab.invalid').origin==='http://quest-lab.invalid';}catch{return false;}
}
/** Mirrors retain their original geometry. Exact loop URL overrides take
 * precedence over the shared base cel; base edits otherwise feed mirror aliases.
 * Rendering still uses mirror=true for flipX and signed x-offset handling. */
export function resolveSourceCel(resources:SourceOverlayResources,view:number,loop:number,cel:number):{cel:SourceCelResource;mirror:boolean;sourceLoop:number}|null {
  if(![view,loop,cel].every(v=>Number.isSafeInteger(v)&&v>=0))return null;
  const v=resources.views[view],l=v?.loops?.[loop];if(!l)return null;
  const mirror=l.mirrorOf!==null&&l.mirrorOf!==undefined,sourceLoop=mirror?l.mirrorOf!:loop;
  const source=v.loops[sourceLoop];if(!source||source.mirrorOf!==null&&source.mirrorOf!==undefined)return null;
  const frame=source.cels?.[cel];if(!frame)return null;
  const key=`view:${view}:${loop}:${cel}`,url=resources.sourceCelOverrides?.[key];
  return {cel:url?{...frame,url}:frame,mirror,sourceLoop};
}
function formatterTokens(text:string):{tokens:string[];error?:string} {
  const tokens:string[]=[];
  for(let i=0;i<text.length;i++)if(text[i]==='%'){
    const match=text.slice(i).match(/^(?:%%|%-?0?[0-9]*[dsucxX])/);
    if(match){tokens.push(match[0]);i+=match[0].length-1;}
    else if(/[A-Za-z0-9+.#*$-]/.test(text[i+1]||''))return {tokens,error:'Unsupported source formatter at character '+i};
  }
  return {tokens};
}

export function applySourceOverrides<T extends SourceOverlayResources>(base:T,content:SourceOverrideContent):SourceOverrideResult<T> {
  const diagnostics:SourceOverrideDiagnostic[]=[],messageEdits:{key:string;module:number;index:number;text:string}[]=[],celEdits:{key:string;view:number;loop:number;cel:number;url:string;mirror:boolean}[]=[];
  const error=(code:string,message:string,key?:string)=>diagnostics.push({severity:'error',code,key,message});
  const revision=content?.revision,validRevision=Number.isSafeInteger(revision)&&revision>=0;
  if(!validRevision||!record(content?.overrides))error('invalid-source-content','Content requires a nonnegative integer revision and an overrides object.');
  const overrides=record(content?.overrides)?content.overrides:{},messages=overrides.sourceMessages,assets=overrides.assets;
  if(messages!==undefined&&!record(messages))error('invalid-source-message-group','sourceMessages must be an object keyed MODULE:NOUN:VERB:CONDITION:SEQUENCE.');
  if(assets!==undefined&&!record(assets))error('invalid-source-asset-group','assets must be an object.');
  if(record(messages))for(const [key,patch]of Object.entries(messages)){
    const id=numbers(key,5,[65535,255,255,255,255]);if(!id){error('invalid-source-message-id','Use canonical numeric MODULE:NOUN:VERB:CONDITION:SEQUENCE.',key);continue;}
    const [module,noun,verb,condition,sequence]=id,entries=base.messages[module]||[],found=entries.map((m,i)=>({m,i})).filter(({m})=>m.noun===noun&&m.verb===verb&&m.condition===condition&&m.sequence===sequence);
    if(found.length!==1){error('missing-source-message','Message ID must identify exactly one imported source entry.',key);continue;}
    if(!record(patch)||Object.keys(patch).some(k=>k!=='text')||typeof patch.text!=='string'){error('invalid-source-message-patch','Source message edits accept only {text:string}.',key);continue;}
    const text=patch.text;
    if(!text.length){error('source-message-empty','Empty text changes the source Message kernel length to0 (not found); remove dialogue behavior through a separate script edit.',key);continue;}
    if(text.includes('\0')||[...text].some(c=>c.charCodeAt(0)>255)||text.length>65535){error('source-message-encoding','Source messages require Latin-1, no NUL, and at most65535 bytes.',key);continue;}
    const original=formatterTokens(found[0].m.text),replacement=formatterTokens(text);
    if(original.error||replacement.error||JSON.stringify(original.tokens)!==JSON.stringify(replacement.tokens)){error('source-message-format','Preserve exact source formatter tokens and their order: '+JSON.stringify(original.tokens)+(replacement.error?' · '+replacement.error:''),key);continue;}
    messageEdits.push({key,module,index:found[0].i,text});
  }
  if(record(assets))for(const [key,patch]of Object.entries(assets)){
    if(!key.startsWith('view:'))continue; // Native hero/background asset IDs are a separate editor.
    const id=numbers(key.slice(5),3,[65535,65535,65535]);if(!id){error('invalid-source-cel-id','Use canonical numeric view:ID:LOOP:CEL.',key);continue;}
    const [view,loop,cel]=id,frame=resolveSourceCel(base,view,loop,cel);if(!frame){error('missing-source-cel','Cel ID must resolve to an imported frame, including mirrored aliases.',key);continue;}
    if(!record(patch)||Object.keys(patch).some(k=>k!=='url')||!isLocalSourceAssetURL(patch.url)){error('invalid-source-cel-patch','Source cel edits accept only {url:rootLocalURL}; geometry changes are not permitted.',key);continue;}
    celEdits.push({key,view,loop,cel,url:patch.url,mirror:frame.mirror});
  }
  const response=(ok:boolean,resources:T):SourceOverrideResult<T>=>({ok,resources,diagnostics,contentRevision:ok?revision:(base.sourceContentRevision??0),requestedRevision:validRevision?revision:null,savesCompatible:true,compatibilityScope:'source-message-text-and-cel-url-only',changes:ok?{messages:messageEdits.map(e=>e.key),cels:celEdits.map(e=>e.key)}:{messages:[],cels:[]},limits});
  if(diagnostics.length)return response(false,base); // Atomic: no partial overlay escapes validation.
  const effective={...base,messages:{...base.messages},views:{...base.views},sourceCelOverrides:{},sourceContentRevision:revision} as T;
  for(const edit of messageEdits){if(effective.messages[edit.module]===base.messages[edit.module])effective.messages[edit.module]=[...base.messages[edit.module]];effective.messages[edit.module][edit.index]={...base.messages[edit.module][edit.index],text:edit.text};}
  for(const edit of celEdits){effective.sourceCelOverrides![edit.key]=edit.url;if(edit.mirror)continue;
    if(effective.views[edit.view]===base.views[edit.view])effective.views[edit.view]={...base.views[edit.view],loops:[...base.views[edit.view].loops]};
    const view=effective.views[edit.view];if(view.loops[edit.loop]===base.views[edit.view].loops[edit.loop])view.loops[edit.loop]={...view.loops[edit.loop],cels:[...view.loops[edit.loop].cels]};
    view.loops[edit.loop].cels[edit.cel]={...base.views[edit.view].loops[edit.loop].cels[edit.cel],url:edit.url};
  }
  return response(true,effective);
}

/** Keep a separate active resource object and nested maps for source kernel
 * closures. Immutable imported maps are never used as hot-update targets.
 * Save snapshotContent(), not a newly received/deferred document. */
export class SourceResourceOverlaySession<T extends SourceOverlayResources> {
  readonly resources:T;
  private active:SourceOverrideContent;
  private pending:SourceOverrideContent|undefined;
  constructor(readonly original:T,initial:SourceOverrideContent={revision:0,overrides:{}}){
    const applied=applySourceOverrides(original,initial);if(!applied.ok)throw new Error('Invalid source content snapshot: '+applied.diagnostics.map(d=>d.message).join('; '));
    this.resources={...applied.resources,messages:{...applied.resources.messages},views:{...applied.resources.views},sourceCelOverrides:{...applied.resources.sourceCelOverrides}};
    this.active=this.narrow(initial);
  }
  private narrow(doc:SourceOverrideContent):SourceOverrideContent {
    const sourceMessages=doc.overrides.sourceMessages,assets=doc.overrides.assets;
    return {revision:doc.revision,overrides:{...(sourceMessages?{sourceMessages:structuredClone(sourceMessages)}:{}),...(assets?{assets:Object.fromEntries(Object.entries(assets as Record<string,unknown>).filter(([k])=>k.startsWith('view:')).map(([k,v])=>[k,structuredClone(v)]))}:{})}};
  }
  snapshotContent():SourceOverrideContent{return structuredClone(this.active);}
  status(){return {contentRevision:this.active.revision,deferredRevision:this.pending?.revision??null,scope:'source-message-text-and-cel-url-only',savesCompatible:true as const};}
  receive(doc:SourceOverrideContent,{deferForPrint=false}:{deferForPrint?:boolean}={}){
    const applied=applySourceOverrides(this.original,doc);if(!applied.ok)return {...this.status(),ok:false,deferred:false,diagnostics:applied.diagnostics};
    if(deferForPrint){this.pending=this.narrow(doc);return {...this.status(),ok:true,deferred:true,diagnostics:[]};}
    // Mutate only these private active map containers; captured host references
    // remain valid and imported source entries themselves remain immutable.
    for(const key of['messages','views','sourceCelOverrides'] as const){const target=this.resources[key] as Record<string,unknown>,source=applied.resources[key] as Record<string,unknown>;for(const id of Object.keys(target))delete target[id];Object.assign(target,source);}
    this.resources.sourceContentRevision=doc.revision;this.active=this.narrow(doc);this.pending=undefined;
    return {...this.status(),ok:true,deferred:false,diagnostics:[]};
  }
  flush({deferForPrint=false}:{deferForPrint?:boolean}={}){return this.pending&&!deferForPrint?this.receive(this.pending):null;}
}
