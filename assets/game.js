(()=>{'use strict';
const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d',{alpha:false});
const game=document.getElementById('game');
const hud=document.getElementById('hud');
const levelLabel=document.getElementById('levelLabel');
const progressBar=document.getElementById('progress');
const progressText=document.getElementById('progressText');
const forwardButton=document.getElementById('forward');
const rotateButton=document.getElementById('rotate');
const screen=document.getElementById('screen');
const TAU=Math.PI*2;
const PAPER='#F4EFE6',INK='#5C4D3C',THREAD='#C85A32';
const STATE={PLAYING:'PLAYING',MOVING:'MOVING',LOSE:'LOSE',WIN:'WIN'};
let state=STATE.PLAYING,W=0,H=0,D=1,last=0,clock=0,bug=null,nodes=[],edges=[],particles=[],grain=[],loseTimer=0,winTimer=0;
const rabbitPoints=[
 [.38,.14], // 0 left ear tip
 [.34,.34], // 1 left ear base outer
 [.43,.34], // 2 left ear base inner
 [.62,.14], // 3 right ear tip
 [.57,.34], // 4 right ear base inner
 [.66,.34], // 5 right ear base outer
 [.50,.38], // 6 forehead / nose bridge
 [.28,.52], // 7 left cheek
 [.72,.52], // 8 right cheek
 [.36,.72], // 9 lower left
 [.50,.78], // 10 chin
 [.64,.72]  // 11 lower right
];
// Two closed ear contours, two short ear-to-forehead joins, and one rounded face contour.
// Exactly two odd-degree vertices (2 and 4): an Euler trail exists from 2 to 4.
const rabbitLinks=[
 [0,1],[1,2],[2,0],
 [3,4],[4,5],[5,3],
 [2,6],[4,6],
 [6,8],[8,11],[11,10],[10,9],[9,7],[7,6]
];
function resize(){
 const r=game.getBoundingClientRect();W=r.width;H=r.height;D=Math.min(window.devicePixelRatio||1,2);
 canvas.width=Math.round(W*D);canvas.height=Math.round(H*D);ctx.setTransform(D,0,0,D,0,0);
 grain=Array.from({length:Math.floor(W*H/780)},()=>({x:Math.random()*W,y:Math.random()*H,r:.3+Math.random()*.8,a:.025+Math.random()*.065}));
 for(const n of nodes){n.x=n.nx*W;n.y=n.ny*H;}
 if(bug){bug.x=bug.nx*W;bug.y=bug.ny*H;}
}
new ResizeObserver(resize).observe(game);
function makeGraph(){
 nodes=rabbitPoints.map((p,id)=>({id,nx:p[0],ny:p[1],x:p[0]*W,y:p[1]*H,targetNodeId:null,neighbors:[],pulse:0}));
 edges=rabbitLinks.map(([ai,bi],id)=>{
  const a=nodes[ai],b=nodes[bi],e={id,a,b,used:false,phase:id*.63};
  a.neighbors.push({node:b,edge:e});b.neighbors.push({node:a,edge:e});return e;
 });
 const tour=makeEulerTour(2);
 if(tour.length!==edges.length)throw new Error('Граф зайца не является эйлеровым.');
 for(const step of tour)if(nodes[step.from].targetNodeId===null)nodes[step.from].targetNodeId=step.to;
 for(const n of nodes)if(n.targetNodeId===null)n.targetNodeId=n.neighbors[0]?.node.id??null;
 const start=nodes[2];
 bug={x:start.x,y:start.y,nx:start.nx,ny:start.ny,currentNode:start,from:null,to:null,edge:null,t:0,speed:205,angle:Math.atan2(nodes[start.targetNodeId].y-start.y,nodes[start.targetNodeId].x-start.x),progress:0,broken:false,swing:0,hang:0,vy:0};
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
function refreshControls(){
 const moving=state===STATE.MOVING,finished=state===STATE.WIN||state===STATE.LOSE;
 forwardButton.disabled=moving||finished;rotateButton.disabled=moving||finished;
 forwardButton.textContent=bug.progress===0?'СТАРТ':'ВПЕРЁД';
 const node=bug.currentNode;
 const next=node?.neighbors.find(v=>v.node.id===node.targetNodeId);
 const invalid=!next||next.edge.used;
 forwardButton.classList.toggle('is-warning',invalid);
}
function rotateArrow(node){
 if((state!==STATE.PLAYING&&state!==STATE.MOVING)||!node||!node.neighbors.length)return;
 const list=node.neighbors,index=list.findIndex(v=>v.node.id===node.targetNodeId);
 const next=list[(index+1+list.length)%list.length];
 node.targetNodeId=next.node.id;node.pulse=1;playPluck();if(node===bug.currentNode)refreshControls();
}
function startMove(){
 if(state!==STATE.PLAYING)return;
 const from=bug.currentNode;
 if(!from||from.targetNodeId===null){lose();return;}
 const to=nodes[from.targetNodeId];
 const link=from.neighbors.find(v=>v.node===to);
 if(!to||!link||link.edge.used){lose();return;}
 bug.from=from;bug.to=to;bug.edge=link.edge;bug.t=0;bug.x=from.x;bug.y=from.y;
 bug.angle=Math.atan2(to.y-from.y,to.x-from.x);state=STATE.MOVING;refreshControls();
}
function tapAt(x,y){
 if(state!==STATE.PLAYING&&state!==STATE.MOVING)return;
 let nearest=null,min=45;
 for(const n of nodes){const d=Math.hypot(x-n.x,y-n.y);if(d<=min){nearest=n;min=d;}}
 if(!nearest)return;
 if(state===STATE.PLAYING&&nearest===bug.currentNode){startMove();return;}
 rotateArrow(nearest);
}
canvas.addEventListener('pointerdown',e=>{
 e.preventDefault();const r=canvas.getBoundingClientRect();tapAt(e.clientX-r.left,e.clientY-r.top);
},{passive:false});
forwardButton.addEventListener('click',startMove);
rotateButton.addEventListener('click',()=>{if(state===STATE.PLAYING)rotateArrow(bug.currentNode);});
document.getElementById('restart').addEventListener('click',restart);
function restart(){
 state=STATE.PLAYING;loseTimer=0;winTimer=0;particles=[];screen.style.display='none';
 makeGraph();setProgress();refreshControls();
}
function lose(){
 if(state===STATE.LOSE||state===STATE.WIN)return;
 state=STATE.LOSE;loseTimer=0;bug.from=bug.currentNode;
 if(bug.edge){bug.from=bug.from||bug.currentNode;bug.edge=null;}
 bug.broken=true;bug.hang=0;bug.vy=12;
 for(let i=0;i<28;i++)particles.push({x:bug.x,y:bug.y,vx:(Math.random()-.5)*120,vy:(Math.random()-.7)*110,life:1,color:i%2?'#C85A32':'#7A5940',r:1.5+Math.random()*3});
 refreshControls();
}
function win(){state=STATE.WIN;winTimer=0;refreshControls();for(let b=0;b<5;b++){const ox=W*(.2+Math.random()*.6),oy=H*(.2+Math.random()*.35);for(let i=0;i<22;i++){const a=TAU*i/22,sp=45+Math.random()*110;particles.push({x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1.6,color:['#C85A32','#D9A441','#588157','#477DA8'][b%4],r:1.5+Math.random()*3});}}}
function update(dt){
 clock+=dt;
 for(const n of nodes)n.pulse=Math.max(0,n.pulse-dt*2.3);
 if(state===STATE.MOVING){
  const dx=bug.to.x-bug.from.x,dy=bug.to.y-bug.from.y,dist=Math.hypot(dx,dy)||1;
  bug.t=Math.min(1,bug.t+bug.speed*dt/dist);bug.x=bug.from.x+dx*bug.t;bug.y=bug.from.y+dy*bug.t;
  bug.nx=bug.x/W;bug.ny=bug.y/H;
  if(bug.t>=1){
   bug.edge.used=true;bug.progress++;bug.currentNode=bug.to;bug.x=bug.to.x;bug.y=bug.to.y;bug.nx=bug.to.nx;bug.ny=bug.to.ny;
   bug.from=null;bug.to=null;bug.edge=null;bug.t=0;state=STATE.PLAYING;playPluck();setProgress();
   if(edges.every(e=>e.used))win();else refreshControls();
  }
 }
 if(state===STATE.LOSE){
  loseTimer+=dt;bug.hang+=dt;bug.vy+=125*dt;bug.y=Math.min(H*.88,bug.y+bug.vy*dt);bug.x+=Math.sin(bug.hang*3.1)*12*dt;bug.swing=Math.sin(bug.hang*3.3)*.32;
  if(loseTimer>0.85&&screen.style.display==='none')showEnd(false);
 }
 if(state===STATE.WIN){winTimer+=dt;if(winTimer>1.5&&screen.style.display==='none')showEnd(true);}
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=85*dt;p.life-=dt;}
 particles=particles.filter(p=>p.life>0);
}
function showEnd(won){
 screen.className='modal';screen.style.display='flex';
 screen.innerHTML='<div class="card"><div class="eyebrow">SILK &amp; SHAPE · УРОВЕНЬ 1</div><h1>'+(won?'Заяц сплетён!':'Засада! Нить запуталась')+'</h1><p class="subtitle">'+(won?'Все линии пройдены. Получился цельный силуэт зайца.':'Жучок выбрал уже сплетённую линию или попал в тупик.')+'</p><button class="primary" id="again">ЗАНОВО</button></div>';
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
 const target=nodes[n.targetNodeId];if(target){
  const angle=Math.atan2(target.y-n.y,target.x-n.x);ctx.save();ctx.rotate(angle);ctx.translate(20,0);
  ctx.fillStyle='#F07832';ctx.strokeStyle='#fff';ctx.lineWidth=2.6;ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-6,-9);ctx.lineTo(-6,9);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 }
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
function init(){
 levelLabel.textContent='УРОВЕНЬ 1 · ЗАЯЦ';
 makeGraph();resize();setProgress();refreshControls();requestAnimationFrame(frame);
}
init();
})();