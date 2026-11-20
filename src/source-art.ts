/** Presentation-only adapter. Never changes source positions, scripts or physics. */
export type SourceArtMode='original'|'painted';
type Frame={x:number;y:number;w:number;h:number};
export interface HeroLayout {hero:{url:string;sha256:string;atlasWidth:number;atlasHeight:number;frameWidth:number;frameHeight:number;frames:Array<{index:number;frame:Frame;opaqueBounds:Frame;anchor:{x:number;y:number}}>}}
export interface SourceHeroArtInput {actorId:string;view:number;loop:number;cel:number;loopCels:number;originalCel:{height:number;x:number;y:number};mirror:boolean;scaleSignal?:number;scaleX?:number;scaleY?:number}
export function resolveSourceBackground(input:{room:number;picture:number;mode:SourceArtMode},art:any,originalPictures:Record<string,string>){
 const original=originalPictures[String(input.picture)],painted=art.rooms?.[String(input.room)]?.background||art.pictures?.[String(input.picture)];
 if(input.mode==='painted'&&painted)return {kind:'painted' as const,url:painted,room:input.room,picture:input.picture};
 return {kind:'original' as const,url:original,room:input.room,picture:input.picture,...(input.mode==='painted'?{reason:'No painted replacement for this room or picture.'}:{})};
}
export function resolveSourceHero(input:SourceHeroArtInput,art:any,layout:HeroLayout,mode:SourceArtMode){
 const fallback=(reason:string)=>({kind:'original' as const,reason});
 if(mode!=='painted')return fallback('Original presentation selected.');
 if(!/^static:0:ego(?:@\d+)?$/.test(input.actorId))return fallback('Only the source hero is mapped.');
 if(input.view!==0&&input.view!==4)return fallback('This original hero action view has no mapped painted animation.');
 if(!Number.isInteger(input.loop)||input.loop<0||input.loop>7||!Number.isInteger(input.cel)||!Number.isInteger(input.loopCels)||input.loopCels<1||input.cel<0||input.cel>=input.loopCels)return fallback('Unrecognized source loop or cel.');
 const hero=art.hero,meta=layout?.hero;
 if(!hero||!meta||hero.url!==meta.url||hero.frameWidth!==meta.frameWidth||hero.frameHeight!==meta.frameHeight)return fallback('Hero atlas layout must be regenerated for this replacement.');
 // Original NormalEgo heading map: E,W,S,N,SE,SW,NE,NW. Painted rows: S,W,E,N.
 const row=[2,1,0,3,0,0,3,3][input.loop],phase=input.view===4?0:Math.min(3,Math.floor(input.cel*4/input.loopCels)),index=row*4+phase;
 const f=meta.frames.find(f=>f.index===index);
 if(!f||f.opaqueBounds.h<=0||f.frame.w<=0||f.frame.h<=0||f.frame.x<0||f.frame.y<0||f.frame.x+f.frame.w>meta.atlasWidth||f.frame.y+f.frame.h>meta.atlasHeight)return fallback('Painted frame metadata is invalid.');
 if(!Number.isFinite(input.originalCel.height)||input.originalCel.height<=0)return fallback('Original cel geometry is unavailable.');
 const sx=input.scaleSignal&&input.scaleSignal&1?(input.scaleX??128)/128:1,sy=input.scaleSignal&&input.scaleSignal&1?(input.scaleY??128)/128:1;
 if(!Number.isFinite(sx)||!Number.isFinite(sy)||sx<=0||sy<=0)return fallback('Unsupported source scale.');
 const unit=input.originalCel.height*(1080/190)/f.opaqueBounds.h;
 return {kind:'painted' as const,url:hero.url,index,frame:{...f.frame},atlasWidth:meta.atlasWidth,atlasHeight:meta.atlasHeight,origin:{x:f.anchor.x/f.frame.w,y:f.anchor.y/f.frame.h},displaySize:{width:f.frame.w*unit*sx,height:f.frame.h*unit*sy},footOffset:{x:input.mirror?-input.originalCel.x:input.originalCel.x,y:input.originalCel.y+1},flipX:false,sourceView:input.view,sourceLoop:input.loop,sourceCel:input.cel,limits:['Four painted directions; diagonal source movement shares front/back artwork.','Original priority-plane masks may not align with every painted edge.']};
}
