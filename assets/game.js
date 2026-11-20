(()=>{'use strict';
const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d',{alpha:false});
const game=document.getElementById('game');
const hud=document.getElementById('hud');
const levelLabel=document.getElementById('levelLabel');
const levelSelectButton=document.getElementById('levelSelect');
const progressBar=document.getElementById('progress');
const progressText=document.getElementById('progressText');
const screen=document.getElementById('screen');
const TAU=Math.PI*2;
const PAPER='#F4EFE6',INK='#5C4D3C',THREAD='#C85A32';
const STATE={PLAYING:'PLAYING',MOVING:'MOVING',LOSE:'LOSE',WIN:'WIN'};
let state=STATE.PLAYING,W=0,H=0,D=1,last=0,clock=0,bug=null,nodes=[],edges=[],particles=[],grain=[],loseTimer=0,winTimer=0;
const TEMPLATES=[
 {name:'КОНВЕРТ',p:[[.2,.3],[.5,.18],[.8,.3],[.8,.68],[.5,.82],[.2,.68]]},
 {name:'ДОМИК',p:[[.2,.48],[.5,.18],[.8,.48],[.8,.8],[.2,.8]]},
 {name:'АРКА',p:[[.2,.8],[.2,.48],[.28,.28],[.5,.18],[.72,.28],[.8,.48],[.8,.8]]},
 {name:'ЁЛКА',p:[[.5,.15],[.76,.4],[.62,.4],[.82,.62],[.64,.62],[.84,.82],[.16,.82],[.36,.62],[.18,.62],[.38,.4],[.24,.4]]},
 {name:'КРИСТАЛЛ',p:[[.5,.14],[.78,.34],[.84,.58],[.5,.84],[.16,.58],[.22,.34]]},
 {name:'ПЕСОЧНЫЕ ЧАСЫ',p:[[.2,.18],[.8,.18],[.58,.5],[.8,.82],[.2,.82],[.42,.5]]},
 {name:'ЛЕСЕНКА',p:[[.2,.2],[.8,.2],[.8,.36],[.34,.36],[.34,.52],[.8,.52],[.8,.68],[.2,.68]]},
 {name:'ЗВЕЗДА',p:[[.5,.12],[.62,.38],[.88,.4],[.68,.58],[.76,.86],[.5,.7],[.24,.86],[.32,.58],[.12,.4],[.38,.38]]},
 {name:'ПЕТЛЯ С УШКАМИ',p:[[.2,.4],[.25,.22],[.4,.3],[.5,.48],[.6,.3],[.75,.22],[.8,.4],[.72,.72],[.5,.84],[.28,.72]]}
];
let levelIndex=1,LEVELS=[];
function seededRandom(seed){
 let s=seed>>>0;
 return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function sampleClosedPath(path,count){
 const lengths=[],total=0;
 let sum=0;
 for(let i=0;i<path.length;i++){const p=path[i],q=path[(i+1)%path.length],len=Math.hypot(q[0]-p[0],q[1]-p[1]);lengths.push(len);sum+=len;}
 const points=[];
 for(let k=0;k<count;k++){
  let d=sum*k/count,seg=0;
  while(seg<lengths.length-1&&d>lengths[seg]){d-=lengths[seg];seg++;}
  const p=path[seg],q=path[(seg+1)%path.length],t=d/(lengths[seg]||1);
  points.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);
 }
 return points;
}
function eulerRoute(points,links,start=0){
 const adj=points.map(()=>[]);
 links.forEach(([a,b],id)=>{adj[a].push({to:b,id});adj[b].push({to:a,id});});
 const seen=new Set(),stack=[{v:start,edge:null}],route=[];
 while(stack.length){
  const top=stack[stack.length-1],step=adj[top.v].find(x=>!seen.has(x.id));
  if(step){seen.add(step.id);stack.push({v:step.to,edge:{from:top.v,to:step.to,id:step.id}});}
  else{const item=stack.pop();if(item.edge)route.push(item.edge);}
 }
 return route.reverse();
}
function validateGenerated(points,links){
 if(points.length<6||points.length>14||links.length<points.length)return false;
 const degree=points.map(()=>0),adj=points.map(()=>[]);
 const keys=new Set();
 for(const [a,b] of links){
  if(a===b||a<0||b<0||a>=points.length||b>=points.length)return false;
  const key=a<b?a+':'+b:b+':'+a;if(keys.has(key))return false;keys.add(key);
  degree[a]++;degree[b]++;adj[a].push(b);adj[b].push(a);
 }
 if(degree.some(d=>d%2!==0)||degree.filter(d=>d>=4).length<2)return false;
 const reached=new Set([0]),todo=[0];
 while(todo.length){for(const n of adj[todo.pop()])if(!reached.has(n)){reached.add(n);todo.push(n);}}
 if(reached.size!==points.length)return false;
 return eulerRoute(points,links).length===links.length;
}
function generateLevel(levelNumber){
 const number=Math.max(1,Math.floor(Number(levelNumber)||1)),rng=seededRandom(number*2654435761);
 const template=TEMPLATES[Math.floor(rng()*TEMPLATES.length)];
 const count=number<=20?7+Math.floor((number-1)/7):Math.min(14,10+Math.floor(Math.min(1,(number-21)/240)*4));
 const difficulty=Math.min(4,1+Math.floor(number/35));
 for(let attempt=0;attempt<48;attempt++){
  const path=template.p.map(p=>p.slice());
  const mirror=rng()<.5,rotation=(rng()-.5)*.22,scale=.88+rng()*.18,cs=Math.cos(rotation),sn=Math.sin(rotation);
  const points=sampleClosedPath(path,count).map(([x,y])=>{
   let dx=(x-.5)*scale*(mirror?-1:1),dy=(y-.5)*scale;
   const j=(rng()-.5)*.018;
   const rx=dx*cs-dy*sn+j,ry=dx*sn+dy*cs-j;
   return [Math.max(.12,Math.min(.88,.5+rx)),Math.max(.12,Math.min(.88,.5+ry))];
  });
  const links=points.map((_,i)=>[i,(i+1)%count]);
  const occupied=new Set(links.map(([a,b])=>a<b?a+':'+b:b+':'+a));
  const candidates=[];
  for(let i=0;i<count;i++)for(let j=i+1;j<count;j++)for(let k=j+1;k<count;k++){
   const pairs=[[i,j],[j,k],[k,i]];
   if(pairs.every(([a,b])=>!occupied.has(a<b?a+':'+b:b+':a')))candidates.push([i,j,k]);
  }
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const usedVertices=new Set();let added=0;
  for(const tri of candidates){
   if(tri.some(v=>usedVertices.has(v)))continue;
   const pairs=[[tri[0],tri[1]],[tri[1],tri[2]],[tri[2],tri[0]]];
   if(pairs.some(([a,b])=>occupied.has(a<b?a+':'+b:b+':a')))continue;
   for(const [a,b] of pairs){links.push([a,b]);occupied.add(a<b?a+':'+b:b+':a');}
   tri.forEach(v=>usedVertices.add(v));added++;
   if(added>=difficulty)break;
  }
  if(validateGenerated(points,links)){
   const route=eulerRoute(points,links,0);
   return {name:template.name,title:template.name,points,links,start:0,solution:route.length,levelNumber:number};
  }
 }
 // Guaranteed bounded fallback: a simple polygon plus one interior triangle.
 const points=sampleClosedPath(TEMPLATES[(number-1)%TEMPLATES.length].p,Math.max(7,Math.min(14,count)));
 const links=points.map((_,i)=>[i,(i+1)%points.length]);
 const tri=[0,2,4];for(const [a,b] of [[0,2],[2,4],[4,0]])links.push([a,b]);
 if(!validateGenerated(points,links))throw new Error('Не удалось построить проходимый уровень '+number);
 return {name:TEMPLATES[(number-1)%TEMPLATES.length].name,title:TEMPLATES[(number-1)%TEMPLATES.length].name,points,links,start:0,solution:eulerRoute(points,links).length,levelNumber:number};
}

let rabbitPoints=[],rabbitLinks=[];
let boardSize=0,boardLeft=0,boardTop=0;
function mapBoardPoint(nx,ny){
 return {x:boardLeft+nx*boardSize,y:boardTop+ny*boardSize};
}
function resizeCanvas(){
 const r=game.getBoundingClientRect();W=r.width;H=r.height;D=Math.min(window.devicePixelRatio||1,2);
 canvas.width=Math.round(W*D);canvas.height=Math.round(H*D);ctx.setTransform(D,0,0,D,0,0);
 boardSize=Math.min(W*.98,H*.93);
 boardLeft=(W-boardSize)/2;boardTop=(H-boardSize)/2;
 grain=Array.from({length:Math.floor(W*H/780)},()=>({x:Math.random()*W,y:Math.random()*H,r:.3+Math.random()*.8,a:.025+Math.random()*.065}));
 for(const n of nodes){const p=mapBoardPoint(n.nx,n.ny);n.x=p.x;n.y=p.y;}
 if(bug){const p=mapBoardPoint(bug.nx,bug.ny);bug.x=p.x;bug.y=p.y;}
}
function installResizeHandling(){
 window.addEventListener('resize',resizeCanvas,{passive:true});
 window.addEventListener('orientationchange',()=>setTimeout(resizeCanvas,80),{passive:true});
 if('ResizeObserver' in window)new ResizeObserver(resizeCanvas).observe(game);
}
function makeGraph(){
 const level=LEVELS[0];
 rabbitPoints=level.points;rabbitLinks=level.links;
 nodes=rabbitPoints.map((p,id)=>{const q=mapBoardPoint(p[0],p[1]);return {id,nx:p[0],ny:p[1],x:q.x,y:q.y,targetNodeId:null,neighbors:[],pulse:0};});
 edges=rabbitLinks.map(([ai,bi],id)=>{
  const a=nodes[ai],b=nodes[bi],e={id,a,b,used:false,phase:id*.63};
  a.neighbors.push({node:b,edge:e});b.neighbors.push({node:a,edge:e});return e;
 });
 const odd=nodes.filter(n=>n.neighbors.length%2===1).map(n=>n.id);
 if(odd.length!==0&&odd.length!==2)throw new Error('Уровень не имеет эйлерова маршрута.');
 const startId=level.start;
 const tour=makeEulerTour(startId);
 if(tour.length!==edges.length)throw new Error('Граф уровня не связен или не имеет эйлерова маршрута.');
 const endId=tour.length?tour[tour.length-1].to:startId;
 if(odd.length===2&&!odd.includes(startId))throw new Error('Неверная стартовая точка эйлерова маршрута.');
 if(odd.length===0&&endId!==startId)throw new Error('Некорректный эйлеров цикл.');
 // Randomize every peg's initial arrow independently on each level start/restart.
 // The player must inspect the graph and rotate arrows to construct a valid one-pass route.
 for(const n of nodes){
  n.targetNodeId=null;
 }
 const start=nodes[startId];
 bug={x:start.x,y:start.y,nx:start.nx,ny:start.ny,currentNode:start,from:null,to:null,edge:null,t:0,speed:205,angle:0,progress:0,broken:false,swing:0,hang:0,vy:0};
}
function makeEulerTour(start){
 const adj=nodes.map(()=>[]);for(const e of edges){adj[e.a.id].push(e);adj[e.b.id].push(e);}
 const used=new Set(),stack=[{id:start,step:null}],out=[];
 while(stack.length){
  const top=stack[stack.length-1],e=adj[top.id].find(v=>!used.has(v.id));
  if(e){used.add(e.id);const to=e.a.id===top.id?e.b.id:e.a.id;stack.push({id:to,step:{from:top.id,to,edge:e}});}
  else{const item=stack.pop();if(item.step)out.push(item.step);}
 }
 return out.reverse();
}
function setProgress(){
 const p=Math.round(bug.progress/edges.length*100);progressBar.style.width=p+'%';progressText.textContent=p+'%';
}
function startMove(target){
 if(state!==STATE.PLAYING||!target||target===bug.currentNode)return;
 const from=bug.currentNode;
 const link=from.neighbors.find(v=>v.node===target);
 if(!link){from.pulse=1;return;}
 bug.from=from;bug.to=target;bug.edge=link.edge;bug.t=0;bug.x=from.x;bug.y=from.y;
 bug.angle=Math.atan2(target.y-from.y,target.x-from.x);state=STATE.MOVING;
}
function tapAt(x,y){
 if(state!==STATE.PLAYING)return;
 let nearest=null,min=50;
 for(const n of nodes){const d=Math.hypot(x-n.x,y-n.y);if(d<=min){nearest=n;min=d;}}
 if(!nearest||nearest===bug.currentNode)return;
 startMove(nearest);
}
canvas.addEventListener('pointerdown',e=>{
 e.preventDefault();const r=canvas.getBoundingClientRect();tapAt(e.clientX-r.left,e.clientY-r.top);
},{passive:false});
levelSelectButton.addEventListener('click',showLevelPicker);
function loadLevel(index){
 if(!Number.isFinite(index)||index<1||index>1000000)return;
 levelIndex=Math.floor(index);LEVELS=[generateLevel(levelIndex)];state=STATE.PLAYING;loseTimer=0;winTimer=0;particles=[];
 screen.style.display='none';screen.className='';
 levelLabel.textContent='УРОВЕНЬ '+levelIndex+' · '+LEVELS[0].name;
 makeGraph();setProgress();
}
function restart(){loadLevel(levelIndex);}
function nextLevel(){
 loadLevel(levelIndex+1);
}
function showLevelPicker(){
 if(state===STATE.MOVING)return;
 screen.className='modal';screen.style.display='flex';
 screen.innerHTML='<div class="card level-picker"><div class="eyebrow">SILK &amp; SHAPE</div><h1>Выбор уровня</h1><p class="subtitle">Доступно более 1000 процедурно созданных уровней.</p><label class="level-entry">НОМЕР УРОВНЯ<input id="levelNumberInput" type="number" min="1" max="1000000" step="1" value="'+levelIndex+'"></label><button type="button" class="primary" id="goLevel">ОТКРЫТЬ УРОВЕНЬ</button><button type="button" class="picker-cancel" id="closeLevelPicker">НАЗАД</button></div>';
 document.getElementById('goLevel').addEventListener('click',()=>{const value=Number(document.getElementById('levelNumberInput').value);if(Number.isInteger(value)&&value>=1&&value<=1000000)loadLevel(value);});
 document.getElementById('closeLevelPicker').addEventListener('click',()=>{screen.style.display='none';screen.className='';if(state===STATE.WIN)showEnd(true);else if(state===STATE.LOSE)showEnd(false);});
}
function lose(){
 if(state===STATE.LOSE||state===STATE.WIN)return;
 state=STATE.LOSE;loseTimer=0;bug.from=bug.currentNode;
 if(bug.edge){bug.edge=null;}
 bug.broken=true;bug.hang=0;bug.vy=12;
 for(let i=0;i<28;i++)particles.push({x:bug.x,y:bug.y,vx:(Math.random()-.5)*120,vy:(Math.random()-.7)*110,life:1,color:i%2?'#C85A32':'#7A5940',r:1.5+Math.random()*3});

}
function win(){state=STATE.WIN;winTimer=0;for(let b=0;b<5;b++){const ox=W*(.2+Math.random()*.6),oy=H*(.2+Math.random()*.35);for(let i=0;i<22;i++){const a=TAU*i/22,sp=45+Math.random()*110;particles.push({x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1.6,color:['#C85A32','#D9A441','#588157','#477DA8'][b%4],r:1.5+Math.random()*3});}}}
function update(dt){
 clock+=dt;
 for(const n of nodes)n.pulse=Math.max(0,n.pulse-dt*2.3);
 if(state===STATE.MOVING){
  const dx=bug.to.x-bug.from.x,dy=bug.to.y-bug.from.y,dist=Math.hypot(dx,dy)||1;
  bug.t=Math.min(1,bug.t+bug.speed*dt/dist);bug.x=bug.from.x+dx*bug.t;bug.y=bug.from.y+dy*bug.t;
  bug.nx=bug.from.nx+(bug.to.nx-bug.from.nx)*bug.t;bug.ny=bug.from.ny+(bug.to.ny-bug.from.ny)*bug.t;
  if(bug.t>=1){
   const arrived=bug.to,travelledFrom=bug.from,travelledEdge=bug.edge;
   bug.currentNode=arrived;bug.x=arrived.x;bug.y=arrived.y;bug.nx=arrived.nx;bug.ny=arrived.ny;
   bug.from=travelledFrom;bug.to=null;bug.edge=null;bug.t=0;
   if(travelledEdge.used){bug.broken=true;lose();}
   else{
    travelledEdge.used=true;bug.progress++;bug.from=null;state=STATE.PLAYING;playPluck();setProgress();
    if(edges.every(e=>e.used))win();
   }
  }
 }
 if(state===STATE.LOSE){
  loseTimer+=dt;bug.hang+=dt;bug.vy+=125*dt;bug.y=Math.min(H*.88,bug.y+bug.vy*dt);bug.x+=Math.sin(bug.hang*3.1)*12*dt;bug.swing=Math.sin(bug.hang*3.3)*.32;
  if(loseTimer>0.85&&!screen.classList.contains('modal'))showEnd(false);
 }
 if(state===STATE.WIN){winTimer+=dt;if(winTimer>1.5&&!screen.classList.contains('modal'))showEnd(true);}
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=85*dt;p.life-=dt;}
 particles=particles.filter(p=>p.life>0);
}
function showEnd(won){
 const level=LEVELS[0],hasNext=true;
 screen.className='modal';screen.style.display='flex';
 const title=won?(level.title+' сплетён!'):'Засада! Нить уже пройдена';
 const subtitle=won?'Все линии пройдены ровно по одному разу. Отличная работа!':'Жучок повторно прошёл по уже использованной нити и запутался.';
 screen.innerHTML='<div class="card"><div class="eyebrow">SILK &amp; SHAPE · УРОВЕНЬ '+levelIndex+'</div><h1>'+title+'</h1><p class="subtitle">'+subtitle+'</p>'+(won&&hasNext?'<button class="primary" id="nextLevel">СЛЕДУЮЩИЙ УРОВЕНЬ</button>':'')+'<button class="primary" id="again">ЗАНОВО</button></div>';
 const next=document.getElementById('nextLevel');if(next)next.addEventListener('click',nextLevel);
 document.getElementById('again').addEventListener('click',restart);
}
function pluck(){if(!soundOn)return;try{const A=window.AudioContext||window.webkitAudioContext;if(!pluck.audio)pluck.audio=new A();const a=pluck.audio;if(a.state==='suspended')a.resume();const o=a.createOscillator(),g=a.createGain();o.type='triangle';o.frequency.value=480;g.gain.setValueAtTime(.035,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+.19);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.2);}catch(e){}}
let soundOn=false;function playPluck(){pluck();}
function drawBackground(){
 ctx.fillStyle=PAPER;ctx.fillRect(0,0,W,H);
 const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'rgba(255,255,255,.3)');g.addColorStop(1,'rgba(174,143,104,.08)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.save();for(const q of grain){ctx.globalAlpha=q.a;ctx.fillStyle='#92795d';ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,TAU);ctx.fill();}ctx.restore();
 ctx.strokeStyle='rgba(128,101,72,.08)';ctx.lineWidth=1;ctx.strokeRect(10,10,W-20,H-20);
}
function drawYarn(a,b,color,straight=false){
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
 const sag=straight?0:Math.min(8,len*.055);
 const mid={x:(a.x+b.x)/2+nx*sag,y:(a.y+b.y)/2+ny*sag};
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(a.x+1.5,a.y+3);if(straight)ctx.lineTo(b.x+1.5,b.y+3);else ctx.quadraticCurveTo(mid.x+1.5,mid.y+3,b.x+1.5,b.y+3);
 ctx.strokeStyle='rgba(62,43,28,.22)';ctx.lineWidth=8;ctx.stroke();
 const grad=ctx.createLinearGradient(a.x,a.y,b.x,b.y);grad.addColorStop(0,'#fff2d8');grad.addColorStop(.32,color);grad.addColorStop(.82,color);grad.addColorStop(1,'#fff0d2');
 ctx.beginPath();ctx.moveTo(a.x,a.y);if(straight)ctx.lineTo(b.x,b.y);else ctx.quadraticCurveTo(mid.x,mid.y,b.x,b.y);
 ctx.strokeStyle=grad;ctx.lineWidth=4.2;ctx.stroke();
 ctx.beginPath();ctx.moveTo(a.x,a.y-1);if(straight)ctx.lineTo(b.x,b.y-1);else ctx.quadraticCurveTo(mid.x,mid.y-1,b.x,b.y-1);
 ctx.strokeStyle='rgba(255,250,232,.62)';ctx.lineWidth=1;ctx.stroke();ctx.restore();
}
function drawPeg(n){
 ctx.save();ctx.translate(n.x,n.y);
 ctx.fillStyle='rgba(66,46,29,.22)';ctx.beginPath();ctx.ellipse(2,9,13,7,0,0,TAU);ctx.fill();
 ctx.fillStyle='#8A7056';ctx.beginPath();ctx.ellipse(0,4,7,10,0,0,TAU);ctx.fill();
 const shaft=ctx.createLinearGradient(-7,0,7,0);shaft.addColorStop(0,'#815B3D');shaft.addColorStop(.35,'#E7C89E');shaft.addColorStop(.7,'#B78B60');shaft.addColorStop(1,'#6F4D34');
 ctx.fillStyle=shaft;ctx.beginPath();ctx.roundRect(-5,-4,10,13,3);ctx.fill();
 const head=ctx.createRadialGradient(-4,-6,1,0,-2,12);head.addColorStop(0,'#FFF2D6');head.addColorStop(.4,'#D9B78D');head.addColorStop(.8,'#A77A50');head.addColorStop(1,'#68472F');
 ctx.fillStyle=head;ctx.strokeStyle='#684A32';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,-3,10,7.5,0,0,TAU);ctx.fill();ctx.stroke();
 ctx.strokeStyle='rgba(255,246,224,.8)';ctx.beginPath();ctx.arc(-1,-4,6,-.2,2.6);ctx.stroke();
 if(n.pulse>0){ctx.strokeStyle='rgba(240,120,50,'+Math.min(.8,n.pulse)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-3,15+n.pulse*7,0,TAU);ctx.stroke();}
 ctx.restore();
}
function drawBug(){
 if(!bug)return;ctx.save();ctx.translate(bug.x,bug.y);ctx.rotate(bug.angle+(bug.swing||0));
 ctx.strokeStyle='#584332';ctx.lineWidth=1.8;ctx.lineCap='round';
 for(let i=0;i<3;i++)for(const side of [-1,1]){const y=side*(2+i*2),kick=Math.sin(clock*17+i*1.8+(side>0?Math.PI:0))*2.8;ctx.beginPath();ctx.moveTo(-2+i*2,y*.35);ctx.lineTo(-5+i*2,y);ctx.lineTo(-8+i*2,y+side*(5+Math.abs(kick)));ctx.stroke();}
 ctx.fillStyle='rgba(70,48,30,.2)';ctx.beginPath();ctx.ellipse(-2,2,8,5.5,0,0,TAU);ctx.fill();
 ctx.fillStyle='#6D8B4D';ctx.strokeStyle='#4D5738';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(-1,0,8.5,5.7,0,0,TAU);ctx.fill();ctx.stroke();
 ctx.fillStyle='#4D5738';ctx.beginPath();ctx.arc(7,0,3.6,0,TAU);ctx.fill();ctx.fillStyle='#fff9e9';ctx.beginPath();ctx.arc(8.2,-1.2,.8,0,TAU);ctx.arc(8.2,1.2,.8,0,TAU);ctx.fill();ctx.restore();
}
function drawTangle(){
 if(!bug?.broken)return;ctx.save();ctx.translate(bug.x,bug.y);
 for(let i=0;i<7;i++){ctx.beginPath();for(let j=0;j<=30;j++){const a=j/30*TAU*2+i*.8,r=5+Math.sin(a*2+i)*4,x=Math.cos(a)*r,y=Math.sin(a)*r;if(!j)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle=i%2?'#6D8B4D':THREAD;ctx.lineWidth=2.2;ctx.stroke();}
 ctx.restore();if(bug.from)drawYarn(bug.from,{x:bug.x,y:bug.y-2},THREAD,true);
}
function drawField(){
 for(const e of edges){
  if(e.used)drawYarn(e.a,e.b,THREAD,true);
  else{ctx.save();ctx.setLineDash([3,7]);ctx.lineDashOffset=-clock*4;ctx.strokeStyle='#C98A55';ctx.globalAlpha=.82;ctx.lineWidth=2.3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(e.a.x,e.a.y);ctx.lineTo(e.b.x,e.b.y);ctx.stroke();ctx.restore();}
 }
 if(state===STATE.MOVING&&bug.edge)drawYarn(bug.from,{x:bug.x,y:bug.y},THREAD,false);
 nodes.forEach(drawPeg);drawTangle();drawBug();
}
function drawParticles(){for(const p of particles){ctx.save();ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.translate(p.x,p.y);ctx.rotate(clock*4);ctx.fillRect(-p.r,-p.r*.6,p.r*2,p.r*1.2);ctx.restore();}}
function draw(){
 drawBackground();drawField();drawParticles();
}
function frame(ts){const dt=Math.min(.04,(ts-last)/1000||0);last=ts;update(dt);draw();requestAnimationFrame(frame);}
let initialized=false,rafStarted=false;
function init(){
 if(initialized)return;
 initialized=true;
 levelIndex=1;LEVELS=[generateLevel(levelIndex)];
 levelLabel.textContent='УРОВЕНЬ 1 · '+LEVELS[0].name;
 makeGraph();
 resizeCanvas();
 setProgress();
 if(!rafStarted){rafStarted=true;requestAnimationFrame(frame);}
}
function boot(){
 installResizeHandling();
 init();
}
if(document.readyState==='loading'){
 document.addEventListener('DOMContentLoaded',boot,{once:true});
}else{
 boot();
}
window.addEventListener('load',()=>{
 if(!initialized)init();
 resizeCanvas();
},{once:true});
})();