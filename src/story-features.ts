/** Source-linked interaction geometry missing from the room's imported entity list.
 * These are input affordances, not simulated original scripts. The room 11
 * rectangle is a convenient part of the ground, not an original rock object;
 * the source accepted Do on the forest region to collect rocks. Rectangles use
 * the same 320×190 logical coordinates as the source presentation.
 */
export interface StoryFeature {
 id:string; name:string; base:'Feature'; sourceRef:string;
 properties:{nsLeft:number;nsTop:number;nsRight:number;nsBottom:number};
 /** When present, an exact original control-plane color, within the bounds. */
 controlColor?:number;
 /** Optional source sprite for a missing imported prop. */
 image?:string;
}
const feature=(id:string,name:string,rect:[number,number,number,number],sourceRef:string,extra:Partial<StoryFeature>={}):StoryFeature=>({
 id,name,base:'Feature',sourceRef,properties:{nsLeft:rect[0],nsTop:rect[1],nsRight:rect[2],nsBottom:rect[3]},...extra
});
export function storyFeatures(room:number):StoryFeature[]{
 switch(room){
  case 11:case 12:case 17:case 24:case 65:case 81:
   return [feature('rocks','Small stones',[125,148,195,184],'forestRegion.sc:1407')];
  case 96:return [
   feature('theHandle','Handle',[212,77,267,98],'Dor1.sc:409'),
   feature('Dor15','Upper right portal',[300,45,318,105],'Dor1.sc:48'),
   feature('dor7','Central door',[106,3,141,69],'Dor1.sc:299',{image:'/reference/views/96-1-0.png'})
  ];
  default:return [];
 }
}
