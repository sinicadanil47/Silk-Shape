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
const LEVELS=[
 {
  name:'ЗАЯЦ',title:'Заяц',start:2,
  points:[
   [.35,.18],[.28,.36],[.42,.36],[.65,.18],[.58,.36],[.72,.36],
   [.50,.39],[.22,.50],[.78,.50],[.31,.65],[.50,.70],[.69,.65]
  ],
  links:[[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[2,6],[4,6],[6,8],[8,11],[11,10],[10,9],[9,7],[7,6]]
 },
 {
  name:'ПОНЧИК',title:'Пончик',start:0,
  points:Array.from({length:8},(_,i)=>{
   const a=-Math.PI/2+i*Math.PI/4;
   return [.50+.36*Math.cos(a),.50+.36*Math.sin(a)];
  }).concat([[.50,.50]]),
  // Outer ring, two crossing diameters routed through the central peg,
  // and two short inner braces keep every vertex even for an Euler circuit.
  links:[
   [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],
   [7,8],[8,3],[1,8],[8,5],
   [1,3],[5,7]
  ]
 },
 {
  name:'КОРОНА',title:'Корона',start:0,
  points:[
   [.18,.68], // 0 left base corner
   [.50,.68], // 1 base center
   [.82,.68], // 2 right base corner
   [.15,.48], // 3 left side
   [.85,.48], // 4 right side
   [.18,.25], // 5 left tooth tip
   [.34,.42], // 6 left valley
   [.50,.20], // 7 center high tip
   [.66,.42], // 8 right valley
   [.82,.25]  // 9 right tooth tip
  ],
  links:[
   // Continuous crown silhouette
   [0,3],[3,5],[5,6],[6,7],[7,8],[8,9],[9,4],[4,2],[2,1],[1,0],
   // Three internal braces create deliberate branch decisions
   [6,1],[8,1],[6,8]
  ]
 },
 {
  name:'КРИСТАЛЛ',title:'Кристалл',start:2,
  points:[
   [.50,.13], // 0 top
   [.68,.27], // 1 upper right
   [.82,.46], // 2 right
   [.68,.65], // 3 lower right
   [.50,.79], // 4 bottom
   [.32,.65], // 5 lower left
   [.18,.46], // 6 left
   [.32,.27], // 7 upper left
   [.50,.34], // 8 inner upper
   [.64,.46], // 9 inner right
   [.50,.58], // 10 inner lower
   [.36,.46]  // 11 inner left
  ],
  links:[
   [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],
   [0,8],[8,9],[9,10],[10,11],[11,4],[9,2],[10,6],[0,4],
   [9,11],[10,8],[8,11]
  ]
 }
];
let levelIndex=0;
let rabbitPoints=LEVELS[0].points,rabbitLinks=LEVELS[0].links;
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
 const level=LEVELS[levelIndex];
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
 if(index<0||index>=LEVELS.length)return;
 levelIndex=index;state=STATE.PLAYING;loseTimer=0;winTimer=0;particles=[];
 screen.style.display='none';screen.className='';
 levelLabel.textContent='УРОВЕНЬ '+(levelIndex+1)+' · '+LEVELS[levelIndex].name;
 makeGraph();setProgress();
}
function restart(){loadLevel(levelIndex);}
function nextLevel(){
 if(levelIndex>=LEVELS.length-1)return;
 loadLevel(levelIndex+1);
}
function showLevelPicker(){
 if(state===STATE.MOVING)return;
 screen.className='modal';screen.style.display='flex';
 screen.innerHTML='<div class="card level-picker"><div class="eyebrow">SILK &amp; SHAPE</div><h1>Выбор уровня</h1><p class="subtitle">Выбери фигуру, которую хочешь сплести.</p>'+LEVELS.map((level,i)=>'<button type="button" class="level-option'+(i===levelIndex?' current':'')+'" data-level="'+i+'"><span>УРОВЕНЬ '+(i+1)+'</span><strong>'+level.title+'</strong>'+(i===levelIndex?'<small>ТЕКУЩИЙ</small>':'')+'</button>').join('')+'<button type="button" class="picker-cancel" id="closeLevelPicker">НАЗАД</button></div>';
 screen.querySelectorAll('[data-level]').forEach(button=>button.addEventListener('click',()=>loadLevel(Number(button.dataset.level))));
 document.getElementById('closeLevelPicker').addEventListener('click',()=>{
  screen.style.display='none';screen.className='';
  if(state===STATE.WIN)showEnd(true);else if(state===STATE.LOSE)showEnd(false);
 });
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
 const level=LEVELS[levelIndex],hasNext=levelIndex<LEVELS.length-1;
 screen.className='modal';screen.style.display='flex';
 const title=won?(levelIndex===0?'Заяц сплетён!':levelIndex===1?'Пончик готов!':levelIndex===2?'Корона готова!':'Кристалл сплетён!'):'Засада! Нить уже пройдена';
 const subtitle=won?'Все линии пройдены ровно по одному разу. Отличная работа!':'Жучок повторно прошёл по уже использованной нити и запутался.';
 screen.innerHTML='<div class="card"><div class="eyebrow">SILK &amp; SHAPE · УРОВЕНЬ '+(levelIndex+1)+'</div><h1>'+title+'</h1><p class="subtitle">'+subtitle+'</p>'+(won&&hasNext?'<button class="primary" id="nextLevel">СЛЕДУЮЩИЙ УРОВЕНЬ</button>':'')+'<button class="primary" id="again">ЗАНОВО</button></div>';
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
 levelLabel.textContent='УРОВЕНЬ 1 · ЗАЯЦ';
 levelIndex=0;
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