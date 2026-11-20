import Phaser from 'phaser';
export interface PriorityPlane {priorityRaw:string;priorityAtY:number[];priorityBands:number[]}
const cache=new Map<string,Uint8Array>();
export async function loadPriority(info?:PriorityPlane):Promise<Uint8Array|undefined>{
 if(!info)return undefined;if(cache.has(info.priorityRaw))return cache.get(info.priorityRaw);
 const response=await fetch(info.priorityRaw);if(!response.ok)return undefined;const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.length!==320*190)throw Error('Invalid priority plane length');cache.set(info.priorityRaw,bytes);return bytes;
}
/** Original SCI priority rule: background > actor hides the actor; equality remains visible. */
export class SourceOcclusion {
 private masks=new Map<number,{mask:Phaser.Display.Masks.BitmapMask;image:Phaser.GameObjects.Image;key:string}>();
 private applied=new WeakMap<object,number>();
 constructor(private scene:Phaser.Scene,private picture:number,private info:PriorityPlane,private bytes:Uint8Array){}
 apply(actor:Phaser.GameObjects.Image|Phaser.GameObjects.Sprite,footY:number,explicitPriority=-1){
  if(this.scene.sys.game.renderer.type!==Phaser.WEBGL)return;
  const priority=explicitPriority>=0?explicitPriority:this.info.priorityAtY[Phaser.Math.Clamp(Math.floor(footY),0,189)]??0;
  if(this.applied.get(actor)===priority)return;
  let entry=this.masks.get(priority);
  if(!entry){
   const key=`priority-mask-${this.picture}-${priority}`;
   if(this.scene.textures.exists(key))this.scene.textures.remove(key);
   const texture=this.scene.textures.createCanvas(key,320,190)!;
   const context=texture.context,imageData=context.createImageData(320,190);
   for(let i=0;i<this.bytes.length;i++){const p=i*4;imageData.data[p]=255;imageData.data[p+1]=255;imageData.data[p+2]=255;imageData.data[p+3]=this.bytes[i]<=priority?255:0;}
   context.putImageData(imageData,0,0);texture.refresh();
   const image=this.scene.make.image({x:0,y:0,key,add:false}).setOrigin(0).setDisplaySize(1440,1080);
   const mask=image.createBitmapMask();entry={mask,image,key};this.masks.set(priority,entry);
  }
  actor.setMask(entry.mask);this.applied.set(actor,priority);
 }
 destroy(){for(const {mask,image,key}of this.masks.values()){mask.destroy();image.destroy();if(this.scene.textures.exists(key))this.scene.textures.remove(key)}this.masks.clear();}
}
