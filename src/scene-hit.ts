/** Test the same source priority plane used to mask a scene actor. */
export function visibleInPriorityPlane(bytes:Uint8Array,priority:number|undefined,worldX:number,worldY:number):boolean {
 if(priority===undefined)return true;
 const x=Math.floor(worldX/4.5),y=Math.floor(worldY*190/1080);
 return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<320&&y>=0&&y<190&&bytes[y*320+x]<=priority;
}
interface HitSprite {
 width:number;height:number;displayOriginX:number;displayOriginY:number;flipX:boolean;flipY:boolean;isCropped:boolean;
 _crop:{x:number;y:number;width:number;height:number};
 getWorldTransformMatrix():{transformPoint(x:number,y:number):{x:number;y:number}};
}
/** InputManager supplies frame-local coordinates with display origin restored. */
export function visibleSpriteHit(sprite:HitSprite,x:number,y:number,pixel:(x:number,y:number)=>boolean,visibleAt:(x:number,y:number)=>boolean):boolean {
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=sprite.width||y>=sprite.height)return false;
 const crop=sprite._crop;
 if(sprite.isCropped){const left=sprite.flipX?sprite.width-crop.x-crop.width:crop.x,top=sprite.flipY?sprite.height-crop.y-crop.height:crop.y;
  if(x<left||y<top||x>=left+crop.width||y>=top+crop.height)return false;}
 const px=sprite.flipX?sprite.width-1-Math.floor(x):Math.floor(x),py=sprite.flipY?sprite.height-1-Math.floor(y):Math.floor(y);
 if(!pixel(px,py))return false;
 const world=sprite.getWorldTransformMatrix().transformPoint(x-sprite.displayOriginX,y-sprite.displayOriginY);
 return visibleAt(world.x,world.y);
}
