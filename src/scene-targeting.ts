/** Exact SCI control-plane feature selection for scene background clicks.
 * A control mask is authoritative; a bounding rectangle never widens it.
 */
export function sourceFeatureAt<T extends {base?:string;properties?:Record<string,any>}>(entities:T[],x:number,y:number,control?:Uint8Array):T|undefined {
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>=320||y<0||y>=190)return;
 const pixel=control?.[Math.floor(y)*320+Math.floor(x)];
 const candidates=entities.flatMap((entity,index)=>{
  if(entity.base!=='Feature')return [];
  const p=entity.properties||{},mask=p.onMeCheck;
  if(Number.isInteger(mask)&&mask>0){
   if(pixel===undefined||pixel>15||!(mask&(1<<pixel)))return [];
   let bits=0;for(let n=mask&0xffff;n;n>>>=1)bits+=n&1;
   return [{entity,rank:bits,index}];
  }
  const {nsLeft:l,nsTop:t,nsRight:r,nsBottom:b}=p;
  if(![l,t,r,b].every(Number.isFinite)||x<l||x>=r||y<t||y>=b)return [];
  return [{entity,rank:100+(r-l)*(b-t)/60800,index}];
 });
 // More specific source masks take priority over a broad terrain feature.
 return candidates.sort((a,b)=>a.rank-b.rank||b.index-a.index)[0]?.entity;
}
