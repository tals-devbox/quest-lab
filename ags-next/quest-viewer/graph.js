'use strict';
// Private quest/source data is supplied by the installed pack, never embedded here.
window.QuestGraph=(()=>{
 const NS='http://www.w3.org/2000/svg',memory=new Map();
 const svg=(name,attrs={})=>{const n=document.createElementNS(NS,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
 const html=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
 function mount(host,{graph,selected,onSelect,key,notes=new Set()}){
  const nodes=graph.nodes||[],ids=new Set(nodes.map(n=>n.id)),edges=(graph.edges||[]).filter(e=>ids.has(e.from)&&ids.has(e.to)),out=new Map(nodes.map(n=>[n.id,[]]));
  for(const e of edges)out.get(e.from).push(e);
  const back=new Set(),visited=new Set(),stack=new Set();
  function visit(id){if(visited.has(id))return;visited.add(id);stack.add(id);for(const e of out.get(id)){if(stack.has(e.to))back.add(e);else visit(e.to);}stack.delete(id);}
  if(ids.has(graph.entry))visit(graph.entry);for(const n of nodes)visit(n.id);
  const degree=new Map(nodes.map(n=>[n.id,0])),rank=new Map(nodes.map(n=>[n.id,0]));for(const e of edges)if(!back.has(e))degree.set(e.to,degree.get(e.to)+1);
  const queue=nodes.filter(n=>degree.get(n.id)===0).map(n=>n.id);for(let i=0;i<queue.length;i++){const id=queue[i];for(const e of out.get(id))if(!back.has(e)){rank.set(e.to,Math.max(rank.get(e.to),rank.get(id)+1));degree.set(e.to,degree.get(e.to)-1);if(!degree.get(e.to))queue.push(e.to);}}
  if(graph.id==='overview')nodes.forEach((n,i)=>rank.set(n.id,Math.floor(i/3)));
  const levels=new Map();for(const n of nodes){const r=rank.get(n.id);if(!levels.has(r))levels.set(r,[]);levels.get(r).push(n);}
  // Centre parents over their children where possible, keeping branch rows separate.
  const boxW=260,boxH=100,gapX=40,gapY=74,maxRow=Math.max(1,...[...levels.values()].map(a=>a.length)),width=maxRow*(boxW+gapX)+80,height=(Math.max(0,...rank.values())+1)*(boxH+gapY)+80,pos=new Map();
  for(const[r,row]of levels){const left=(width-row.length*(boxW+gapX)+gapX)/2;row.forEach((n,i)=>pos.set(n.id,{x:left+i*(boxW+gapX),y:40+r*(boxH+gapY)}));}
  const tools=html('div',null,'graph-tools'),stage=html('div',null,'graph-stage');stage.tabIndex=0;stage.setAttribute('aria-label','Quest diagram. Drag to pan. Use zoom buttons or pinch to zoom. Tab to select nodes.');
  const draw=svg('svg',{width:'100%',height:'100%',role:'group','aria-label':graph.title||'Quest diagram'}),defs=svg('defs'),marker=svg('marker',{id:'quest-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});marker.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#708b87'}));defs.append(marker);draw.append(defs);const world=svg('g');draw.append(world);stage.append(draw);host.append(tools,stage);
  const groups=new Map(),unreachable=new Set(graph.analysis?.unreachable||[]),dead=new Set(graph.analysis?.deadEnds||[]);
  for(const e of edges){const a=pos.get(e.from),b=pos.get(e.to),x1=a.x+boxW/2,y1=a.y+boxH,x2=b.x+boxW/2,y2=b.y;const isBack=back.has(e),bend=isBack?Math.max(a.x,b.x)+boxW+28:(y1+y2)/2;const d=isBack?`M${x1},${y1} C${bend},${y1+40} ${bend},${y2-40} ${x2},${y2}`:`M${x1},${y1} C${x1},${bend} ${x2},${bend} ${x2},${y2}`;world.append(svg('path',{d,class:'graph-edge'+(isBack?' graph-back':''),'marker-end':'url(#quest-arrow)'}));if(e.label){const t=svg('text',{x:isBack?bend:(x1+x2)/2+8,y:isBack?(y1+y2)/2:(y1+y2)/2-6,class:'edge-label'});t.textContent=e.label.slice(0,65);world.append(t);}}
  for(const n of nodes){const p=pos.get(n.id),g=svg('g',{transform:`translate(${p.x} ${p.y})`,class:'graph-node '+(n.type||'action')+(n.id===selected?' selected':'')+(unreachable.has(n.id)?' unreachable':'')+(dead.has(n.id)?' dead-end':''),role:'button',tabindex:0,'aria-label':n.title+(notes.has(n.id)?', has comments':''),'aria-pressed':String(n.id===selected)});g.dataset.nodeId=n.id;g.append(svg('rect',{width:boxW,height:boxH,rx:n.type==='condition'?20:9}));const type=svg('text',{x:14,y:21,class:'node-type'});type.textContent=(n.type||'step')+(notes.has(n.id)?' · comment':'');g.append(type);const words=String(n.title||n.id).split(/\s+/),lines=[];let line='';for(const word of words){if((line+' '+word).length>34&&line){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);lines.slice(0,3).forEach((line,i)=>{const t=svg('text',{x:14,y:43+i*18,class:'node-title'});t.textContent=line.slice(0,38)+(i===2&&lines.length>3?'…':'');g.append(t);});const title=svg('title');title.textContent=n.title;g.append(title);g.addEventListener('click',()=>{if(!moved)onSelect(n.id);});g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(n.id);}});world.append(g);groups.set(n.id,g);}
  let state=memory.get(key),x=state?.x||0,y=state?.y||0,z=state?.z||.85,moved=false;
  const status=html('span',null,'graph-count'),search=html('input');search.type='search';search.placeholder='Find a node';search.setAttribute('aria-label','Find a diagram node');
  function apply(){world.setAttribute('transform',`translate(${x} ${y}) scale(${z})`);memory.set(key,{x,y,z});status.textContent=nodes.length+' nodes · '+edges.length+' connections · '+Math.round(z*100)+'%';}
  function zoom(next,cx=stage.clientWidth/2,cy=stage.clientHeight/2){const nz=Math.max(.08,Math.min(2.5,next)),ratio=nz/z;x=cx-(cx-x)*ratio;y=cy-(cy-y)*ratio;z=nz;apply();}
  function fit(){z=Math.max(.08,Math.min(1,(stage.clientWidth-32)/width,(stage.clientHeight-32)/height));x=(stage.clientWidth-width*z)/2;y=16;apply();}
  function focus(id){const p=pos.get(id);if(!p)return;z=Math.max(.65,z);x=stage.clientWidth/2-(p.x+boxW/2)*z;y=stage.clientHeight/2-(p.y+boxH/2)*z;apply();}
  const btn=(name,fn)=>{const b=html('button',name,'secondary');b.type='button';b.addEventListener('click',fn);tools.append(b);};btn('−',()=>zoom(z/1.25));btn('+',()=>zoom(z*1.25));btn('Fit',fit);btn('Selected',()=>focus(selected||graph.entry));tools.append(search,status);
  search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();for(const n of nodes)groups.get(n.id).classList.toggle('search-match',!!q&&JSON.stringify(n).toLowerCase().includes(q));});search.addEventListener('keydown',e=>{if(e.key==='Enter'){const match=nodes.find(n=>JSON.stringify(n).toLowerCase().includes(search.value.toLowerCase()));if(match){focus(match.id);onSelect(match.id);}}});
  const pointers=new Map();let gesture=null;
  stage.addEventListener('pointerdown',e=>{if(e.target.closest('.graph-node'))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});stage.setPointerCapture(e.pointerId);moved=false;gesture={x,y,z,points:[...pointers.values()]};});
  stage.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const pts=[...pointers.values()],first=gesture.points[0];if(pts.length===1){const dx=pts[0].x-first.x,dy=pts[0].y-first.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;x=gesture.x+dx;y=gesture.y+dy;apply();}else if(gesture.points.length===2){const dist=a=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),r=stage.getBoundingClientRect();zoom(gesture.z*dist(pts)/Math.max(1,dist(gesture.points)),(pts[0].x+pts[1].x)/2-r.left,(pts[0].y+pts[1].y)/2-r.top);moved=true;}});
  const end=e=>{pointers.delete(e.pointerId);gesture=pointers.size?{x,y,z,points:[...pointers.values()]}:null;setTimeout(()=>{moved=false;},0);};stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);
  stage.addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey||e.metaKey){const r=stage.getBoundingClientRect();zoom(z*Math.exp(-e.deltaY*.002),e.clientX-r.left,e.clientY-r.top);}else{x-=e.deltaX;y-=e.deltaY;apply();}},{passive:false});
  stage.addEventListener('keydown',e=>{if(e.target!==stage)return;const delta={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]}[e.key];if(delta){e.preventDefault();x+=delta[0];y+=delta[1];apply();}});
  requestAnimationFrame(()=>{if(!state){if(nodes.length<20)fit();else focus(graph.entry);}else{apply();const p=pos.get(selected);if(p&&(p.x*z+x<0||p.x*z+x+boxW*z>stage.clientWidth||p.y*z+y<0||p.y*z+y+boxH*z>stage.clientHeight))focus(selected);}});
  return {focus,fit};
 }
 return {mount};
})();
