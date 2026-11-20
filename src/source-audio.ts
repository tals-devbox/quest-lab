/** Read-only audible sink for committed source sound events. The SCI logical
 * driver exclusively owns cues, completion and gameplay; no callback is sent back. */
import {QuestAudio} from './audio';
import type {Snapshot,RuntimeEvent} from './sci-runtime/model';
export interface SourceAudioPort {
 load():Promise<unknown>;unlock():Promise<boolean>;setVolume(value:number):void;setSlotVolume(slot:string,value:number):unknown;
 play(id:number,options:{slot:string;loop:boolean}):Promise<{ok:boolean;reason?:string}>;
 stop(slot?:string):void;pause(slot?:string):void;resume(slot?:string):unknown;
 fade(slot:string,target:number,durationMs:number,options:{stopWhenSilent:boolean}):unknown;
 status():any;
}
type SoundState={objectId:string;number:number;loop:number;volume:number;priority:number;playing:boolean;paused:boolean;fade?:{target:number;durationMs:number;stop:boolean;at:number}};
export class SourceAudioOutput {
 private enabled=false;private loaded=false;private userVolume=.35;private userPaused=false;private lastEvent=0;private generation=0;
 private states=new Map<string,SoundState>();private diagnostics=new Set<string>();
 constructor(private audio:SourceAudioPort=new QuestAudio({volume:.35}),private now=()=>performance.now()){}
 private slot(id:string){return'source:'+id;}
 /** Must be invoked directly from a trusted user button. Unlock precedes fetch. */
 async enable(){if(!await this.audio.unlock())throw Error('Browser audio is still locked.');if(!this.loaded){await this.audio.load();this.loaded=true;}this.enabled=true;this.audio.setVolume(this.userVolume);await Promise.allSettled([...this.states.values()].filter(s=>s.playing).map(s=>this.start(s)));return this.status();}
 disable(){this.enabled=false;this.audio.stop();}
 setVolume(value:number){if(!Number.isFinite(value))throw Error('Source audio master volume must be finite.');this.userVolume=Math.max(0,Math.min(1,value));this.audio.setVolume(this.userVolume);}
 setPaused(paused:boolean){if(this.userPaused===paused)return;this.userPaused=paused;if(!this.enabled)return;for(const s of this.states.values())if(s.playing){if(paused||s.paused)this.audio.pause(this.slot(s.objectId));else this.audio.resume(this.slot(s.objectId));}}
 /** Restore only already-authoritative logical Sound object state. No write to
  * runtime memory, source flags or source callbacks is performed. */
 reset(snapshot:Snapshot){this.generation++;this.audio.stop();this.states.clear();this.lastEvent=Math.max(0,snapshot.nextEvent-1);for(const[key,ref]of Object.entries(snapshot.host)){if(!key.startsWith('sound-object:')||!ref||typeof ref!=='object'||ref.kind!=='object')continue;const id=ref.id,p=snapshot.objects[id]?.properties;if(!p||!snapshot.host['sound:'+id+':playing'])continue;const state:SoundState={objectId:id,number:Number(p.number),loop:Number(p.loop),volume:Number(p.vol),priority:Number(p.priority),playing:true,paused:!!snapshot.host['sound:'+id+':paused']};this.states.set(id,state);if(this.enabled)void this.start(state);} }
 private async start(state:SoundState){if(!this.enabled||!state.playing||!Number.isFinite(state.number)||state.number<=0)return;try{const generation=this.generation,slot=this.slot(state.objectId);this.audio.setSlotVolume(slot,Math.max(0,Math.min(127,state.volume))/127);const result=await this.audio.play(state.number,{slot,loop:state.loop===-1||state.loop>1});if(generation!==this.generation||this.states.get(state.objectId)!==state||!state.playing||!this.enabled){return;}if(!result.ok){this.diagnostics.add(result.reason||'Source audio could not be played.');return;}this.audio.setSlotVolume(slot,Math.max(0,Math.min(127,state.volume))/127);if(this.userPaused||state.paused)this.audio.pause(slot);if(state.fade)this.applyFade(state);}catch(e){this.diagnostics.add('Audible source playback failed: '+e);}}
 private applyFade(state:SoundState){if(!this.enabled||!state.fade)return;const f=state.fade,duration=Math.max(0,f.durationMs-(this.now()-f.at));this.audio.fade(this.slot(state.objectId),f.target,duration,{stopWhenSilent:f.stop&&f.target===0});}
 consume(events:RuntimeEvent[]){for(const event of events){const id=event.eventId??0;if(!id||id<=this.lastEvent)continue;this.lastEvent=id;
   if(event.kind==='sound-logical-completion'||event.kind==='sound-logical-stop'){const objectId=(event.actor as any)?.id,state=this.states.get(objectId);if(state){state.playing=false;if(this.enabled)this.audio.stop(this.slot(objectId));}continue;}
   if(event.kind==='sound-logical-loop'){const state=this.states.get((event.actor as any)?.id);if(state)state.loop=Number(event.loop);continue;}
   if(event.kind==='sound-logical-fade-completion'){const objectId=(event.actor as any)?.id,state=this.states.get(objectId);if(state){state.volume=Number(event.volume);state.fade=undefined;if(event.stop){state.playing=false;if(this.enabled)this.audio.stop(this.slot(objectId));}else if(this.enabled)this.audio.setSlotVolume(this.slot(objectId),state.volume/127);}continue;}
   if(event.kind!=='sound-request')continue;const mode=Number(event.mode),args=event.args as any[],sound=event.sound as any;
   if(mode===10&&args[1]===0){for(const state of this.states.values()){state.paused=!!args[2];if(this.enabled){if(this.userPaused||state.paused)this.audio.pause(this.slot(state.objectId));else this.audio.resume(this.slot(state.objectId));}}continue;}
   if(!sound?.objectId)continue;const objectId=String(sound.objectId),slot=this.slot(objectId);let state=this.states.get(objectId);if(!state){state={...sound,playing:false,paused:false};this.states.set(objectId,state!);}state=state!;
   if(mode===8){state={...sound,playing:true,paused:false};this.states.set(objectId,state!);if(this.enabled)void this.start(state!);}
   else if([6,7,9].includes(mode)){state.playing=false;state.paused=false;state.fade=undefined;if(this.enabled)this.audio.stop(slot);}
   else if(mode===10){state.paused=!!args[2];if(this.enabled){if(this.userPaused||state.paused)this.audio.pause(slot);else this.audio.resume(slot);}}
   else if(mode===11){const ticks=Number(event.fadeDurationTicks),target=Number(args[2])/127;if(!Number.isFinite(ticks)||ticks<0||!Number.isFinite(target)){this.diagnostics.add('Source fade had no verified duration; audible fade withheld.');continue;}state.fade={target:Math.max(0,Math.min(1,target)),durationMs:ticks*1000/60,stop:!!args[5],at:this.now()};this.applyFade(state);}
   else if(mode===14){state.volume=Number(sound.volume);if(this.enabled)this.audio.setSlotVolume(slot,state.volume/127);}
   else if(mode===16)state.loop=Number(sound.loop);
  }}
 status(){return{enabled:this.enabled,userVolume:this.userVolume,approximation:'Original score and PCM; approximate GM instruments. Enabling/restoring restarts current audible tracks. Logical cues remain source-owned.',logicalSounds:[...this.states.values()].map(s=>({...s,fade:s.fade?{...s.fade}:undefined})),audio:this.audio.status(),diagnostics:[...this.diagnostics]};}
}
