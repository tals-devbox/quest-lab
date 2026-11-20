/** Collision-aware world pathfinding. Geometry is in the renderer's 1440×1080 coordinates. */
export interface WalkPoint {x:number;y:number}
export interface WalkPolygon {type:string;points?:number[][];conditional?:{kind:string}[]}
type Obstacle={edges:[WalkPoint,WalkPoint][];minX:number;maxX:number;minY:number;maxY:number};
const cross=(a:WalkPoint,b:WalkPoint,c:WalkPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const EPS=1e-8;
function intersects(a:WalkPoint,b:WalkPoint,c:WalkPoint,d:WalkPoint){
 const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
 const on=(p:WalkPoint,q:WalkPoint,r:WalkPoint)=>Math.abs(cross(p,q,r))<=EPS&&r.x>=Math.min(p.x,q.x)-EPS&&r.x<=Math.max(p.x,q.x)+EPS&&r.y>=Math.min(p.y,q.y)-EPS&&r.y<=Math.max(p.y,q.y)+EPS;
 return (abC>EPS&&abD< -EPS||abC< -EPS&&abD>EPS)&&(cdA>EPS&&cdB< -EPS||cdA< -EPS&&cdB>EPS)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
function obstacles(polygons:WalkPolygon[]):Obstacle[]{return polygons.filter(p=>!p.conditional?.some(c=>c.kind!=='region-room-match')&&['PBarredAccess','PContainedAccess'].includes(p.type)&&p.points&&p.points.length>=3).map(p=>{
 const points=p.points!.map(([x,y])=>({x:x*4.5,y:y*1080/190}));
 return {edges:points.map((point,i)=>[point,points[(i+1)%points.length]] as [WalkPoint,WalkPoint]),minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
});}
/** Both endpoints must already be walkable; crossing or touching an active
 * boundary is conservatively rejected. */
function clearSegment(a:WalkPoint,b:WalkPoint,polygons:Obstacle[]){
 const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);
 for(const poly of polygons){if(maxX<poly.minX-EPS||minX>poly.maxX+EPS||maxY<poly.minY-EPS||minY>poly.maxY+EPS)continue;for(const [c,d] of poly.edges)if(intersects(a,b,c,d))return false;}return true;
}
type Entry={key:number;score:number};
class MinHeap {private a:Entry[]=[];push(e:Entry){let i=this.a.push(e)-1;while(i){const p=(i-1)>>1;if(this.a[p].score<=e.score)break;this.a[i]=this.a[p];i=p}this.a[i]=e}pop():Entry|undefined{if(!this.a.length)return;const top=this.a[0],last=this.a.pop()!;if(this.a.length){let i=0;while(true){let c=i*2+1;if(c>=this.a.length)break;if(c+1<this.a.length&&this.a[c+1].score<this.a[c].score)c++;if(this.a[c].score>=last.score)break;this.a[i]=this.a[c];i=c}this.a[i]=last}return top}get length(){return this.a.length}}
/** Search with 24px grid first, then finer grids for narrow valid passages.
 * Source polygons are not modified. Empty result means no verified path. */
export function findWalkPath(start:WalkPoint,end:WalkPoint,walkable:(x:number,y:number)=>boolean,polygons:WalkPolygon[]):WalkPoint[]{
 if(![start.x,start.y,end.x,end.y].every(Number.isFinite)||!walkable(start.x,start.y)||!walkable(end.x,end.y))return [];
 const blocks=obstacles(polygons);if(clearSegment(start,end,blocks))return [end];
 for(const step of [24,12,6]){
  const cols=Math.ceil(1440/step),rows=Math.ceil(1080/step),startKey=cols*rows,endKey=startKey+1;
  const cell=(p:WalkPoint)=>({x:Math.floor(p.x/step),y:Math.floor(p.y/step)}),a=cell(start),b=cell(end);
  const key=(x:number,y:number)=>y*cols+x,position=(k:number):WalkPoint=>k===startKey?start:k===endKey?end:{x:(k%cols+.5)*step,y:(Math.floor(k/cols)+.5)*step};
  const valid=(x:number,y:number)=>x>=0&&x<cols&&y>=0&&y<rows,walkCache=new Map<number,boolean>();
  const can=(k:number)=>{if(!walkCache.has(k)){const p=position(k);walkCache.set(k,walkable(p.x,p.y));}return walkCache.get(k)!};
  const adjacent=(x:number,y:number)=>Math.abs(x-b.x)<=1&&Math.abs(y-b.y)<=1;
  const came=new Map<number,number>(),cost=new Map<number,number>([[startKey,0]]),heap=new MinHeap();heap.push({key:startKey,score:Math.hypot(start.x-end.x,start.y-end.y)});
  const closed=new Set<number>();let found=false;
  while(heap.length){const item=heap.pop()!,cur=item.key;if(closed.has(cur))continue;if(cur===endKey){found=true;break}closed.add(cur);const p=position(cur),neighbors:number[]=[];
   if(cur===startKey){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=a.x+dx,y=a.y+dy;if(valid(x,y))neighbors.push(key(x,y));}if(Math.abs(a.x-b.x)<=1&&Math.abs(a.y-b.y)<=1)neighbors.push(endKey);}
   else{const x=cur%cols,y=Math.floor(cur/cols);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy){const nx=x+dx,ny=y+dy;if(valid(nx,ny))neighbors.push(key(nx,ny));}if(adjacent(x,y))neighbors.push(endKey);}
   for(const next of neighbors){if(closed.has(next)||next!==endKey&&!can(next))continue;const q=position(next);if(!clearSegment(p,q,blocks))continue;const nextCost=cost.get(cur)!+Math.hypot(p.x-q.x,p.y-q.y);if(nextCost>=(cost.get(next)??Infinity))continue;cost.set(next,nextCost);came.set(next,cur);heap.push({key:next,score:nextCost+Math.hypot(q.x-end.x,q.y-end.y)});}
  }
  if(found){const out:WalkPoint[]=[];let cur=endKey;while(cur!==startKey){out.push(position(cur));cur=came.get(cur)!;}return out.reverse();}
 }
 return [];
}
