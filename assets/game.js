(()=>{'use strict';
const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d'),game=document.getElementById('game'),hud=document.getElementById('hud'),screen=document.getElementById('screen');
const levelLabel=document.getElementById('levelLabel'),progressBar=document.getElementById('progress'),progressText=document.getElementById('progressText');
const PAPER='#F4EFE6',INK='#5C4D3C',TAU=Math.PI*2,NS='http://www.w3.org/2000/svg';
const COLORS=['#D9534F','#2A9D8F','#477DA8','#E9C46A','#C85A32','#588157','#8C6BB1'];
const STATE={MENU:'MENU',PLAYING:'PLAYING',WIN:'WIN',LOSE:'LOSE'};
const levels=[
{name:'ПОНЧИК',file:'doughnut-svgrepo-com.svg',speed:72,tutorial:'Обведи пончик по колышкам'},
{name:'КРУАССАН',file:'croissant-svgrepo-com.svg',speed:76,tutorial:'Следуй за жучком и натягивай нить'},
{name:'КОФЕ',file:'coffee-svgrepo-com.svg',speed:80,tutorial:'На перекрёстке выбирай направление'},
{name:'РОЖОК МОРОЖЕНОГО',file:'ice-cream-cone-svgrepo-com.svg',speed:84,tutorial:'Закончи оба цветных маршрута'},
{name:'РЫБКА',file:'fish-svgrepo-com.svg',speed:88},
{name:'КУРИНАЯ НОЖКА',file:'chicken-leg-svgrepo-com.svg',speed:91},
{name:'БЕКОН',file:'bacon-svgrepo-com.svg',speed:94},
{name:'ШОКОЛАДКА',file:'chocolate-svgrepo-com.svg',speed:97},
{name:'КОЛА',file:'cola-svgrepo-com.svg',speed:100},
{name:'ХОТ-ДОГ',file:'hot-dog-svgrepo-com.svg',speed:103},
{name:'ЭСКИМО',file:'ice-cream-svgrepo-com.svg',speed:106},
{name:'БУРГЕР',file:'burger-svgrepo-com.svg',speed:110}
];
let gameState=STATE.MENU,level=0,W=0,H=0,D=1,last=0,time=0,audio=null;
let soundOn=localStorage.getItem('silkShapeSound')!=='off';
let savedLevel=Math.max(0,Math.min(11,parseInt(localStorage.getItem('silkShapeLevel')||'0',10)||0));
let pegs=[],edges=[],spiders=[],particles=[],grain=[],levelArt=null,reveal=0,winElapsed=0,fireworksStarted=false,loadToken=0,loseElapsed=0;
const hiddenSvg=document.createElementNS(NS,'svg');hiddenSvg.setAttribute('xmlns',NS);hiddenSvg.style.cssText='position:absolute;width:1px;height:1px;left:-10000px;top:-10000px;overflow:visible';document.body.appendChild(hiddenSvg);
let demo={bugs:[],pegs:[],edges:[],art:null,phase:'draw',hold:0,fade:0,reveal:0,ready:false,loading:false};
function resize(){const r=game.getBoundingClientRect();W=r.width;H=r.height;D=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*D);canvas.height=Math.round(H*D);ctx.setTransform(D,0,0,D,0,0);grain=Array.from({length:Math.floor(W*H/850)},()=>({x:Math.random()*W,y:Math.random()*H,a:Math.random()*.11+.025,r:Math.random()*.8+.25}));reflow();if(demo.ready){for(const p of demo.pegs){p.x=p.nx*W;p.y=p.ny*H;}const b=demo.bugs[0];if(b){b.x=b.nx*W;b.y=b.ny*H;}}}
new ResizeObserver(resize).observe(game);
function reflow(){for(const p of pegs){p.x=p.nx*W;p.y=p.ny*H;}for(const s of spiders){s.x=s.nx*W;s.y=s.ny*H;}if(levelArt)levelArt.rect=artRect(levelArt.vb);}
function artRect(vb){const side=Math.min(W*.74,H*.52),scale=side/Math.max(vb.w,vb.h);return{x:(W-vb.w*scale)/2-vb.x*scale,y:(H-vb.h*scale)/2-vb.y*scale,w:vb.w*scale,h:vb.h*scale,scale};}
function clearGame(){pegs=[];edges=[];spiders=[];particles=[];if(levelArt&&levelArt.url)URL.revokeObjectURL(levelArt.url);levelArt=null;reveal=0;winElapsed=0;fireworksStarted=false;loseElapsed=0;progressBar.style.width='0%';progressText.textContent='0%';}
function audioInit(){if(!soundOn)return;if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(A)audio=new A();}if(audio&&audio.state==='suspended')audio.resume();}
function tone(f,d,type='sine',v=.03,delay=0){if(!audio||!soundOn)return;const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+delay;o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+d+.02);}
function pluck(c){tone(410+c*47,.22,'triangle',.03);tone(660+c*31,.16,'sine',.014,.035);}
function chord(){[392,494,587,784,988].forEach((f,i)=>tone(f,.55,'triangle',.028,i*.065));}
function loadSvg(file){return fetch('./assets/levels/'+file).then(r=>{if(!r.ok)throw Error('SVG не найден: '+file);return r.text();}).then(text=>{const doc=new DOMParser().parseFromString(text,'image/svg+xml');if(doc.querySelector('parsererror'))throw Error('Некорректный SVG: '+file);const root=doc.documentElement,v=(root.getAttribute('viewBox')||'0 0 1024 1024').trim().split(/[ ,]+/).map(Number);const vb={x:v[0]||0,y:v[1]||0,w:v[2]||1024,h:v[3]||1024};const image=new Image();const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));image.src=url;return new Promise((resolve,reject)=>{image.onload=()=>resolve({doc,vb,image,url,file});image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Не удалось отобразить '+file));};});});}
function fillOf(el){let f=el.getAttribute('fill');if(!f||f==='inherit'){const st=el.getAttribute('style')||'';f=(st.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i)||[])[1];}return f&&f!=='none'?f:'#8B684E';}
function sampleSvg(def,count=8,maxPaths=2){
 hiddenSvg.replaceChildren();hiddenSvg.setAttribute('viewBox',[def.vb.x,def.vb.y,def.vb.w,def.vb.h].join(' '));
 const candidates=[...def.doc.querySelectorAll('path')].map((source,index)=>{const node=document.importNode(source,true);hiddenSvg.appendChild(node);let len=0,box={width:0,height:0};try{len=node.getTotalLength();box=node.getBBox();}catch(e){}return{node,len,box,fill:fillOf(source),index,area:box.width*box.height};}).filter(x=>x.len>0&&x.area>def.vb.w*def.vb.h*.003&&x.len>35).sort((a,b)=>b.len-a.len);
 if(!candidates.length)throw Error('В SVG нет подходящих крупных контуров: '+def.file);
 const selected=candidates.filter(x=>x.len>=candidates[0].len*.105).slice(0,maxPaths);
 const scale=Math.min(W*.72,H*.49)/Math.max(def.vb.w,def.vb.h),ox=(W-def.vb.w*scale)/2-def.vb.x*scale,oy=(H-def.vb.h*scale)/2-def.vb.y*scale;
 const routes=selected.map((c,ri)=>{const n=8,pts=[];for(let i=0;i<n;i++){const p=c.node.getPointAtLength(c.len*i/n);pts.push({x:ox+p.x*scale,y:oy+p.y*scale});}return{color:c.fill,points:pts,sourceIndex:c.index};});
 hiddenSvg.replaceChildren();return{routes,rect:{x:ox+def.vb.x*scale,y:oy+def.vb.y*scale,w:def.vb.w*scale,h:def.vb.h*scale},scale};
}
function lineIntersection(a,b,c,d){const den=(b.x-a.x)*(d.y-c.y)-(b.y-a.y)*(d.x-c.x);if(Math.abs(den)<1e-7)return null;const t=((c.x-a.x)*(d.y-c.y)-(c.y-a.y)*(d.x-c.x))/den,u=((c.x-a.x)*(b.y-a.y)-(c.y-a.y)*(b.x-a.x))/den;if(t<=.025||t>=.975||u<=.025||u>=.975)return null;return{t,u,p:{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)}};}
function addCrossings(routes){if(routes.length<2)return;const adds=routes.map(()=>new Map());for(let r=0;r<routes.length;r++)for(let q=r+1;q<routes.length;q++){const A=routes[r].points,B=routes[q].points;for(let i=0;i<A.length;i++)for(let j=0;j<B.length;j++){const hit=lineIntersection(A[i],A[(i+1)%A.length],B[j],B[(j+1)%B.length]);if(hit){if(!adds[r].has(i))adds[r].set(i,[]);if(!adds[q].has(j))adds[q].set(j,[]);adds[r].get(i).push({t:hit.t,p:hit.p});adds[q].get(j).push({t:hit.u,p:hit.p});}}}
for(let r=0;r<routes.length;r++){const src=routes[r].points,out=[];for(let i=0;i<src.length;i++){out.push(src[i]);(adds[r].get(i)||[]).sort((a,b)=>a.t-b.t).forEach(v=>out.push(v.p));}routes[r].points=out;}}
function makeEulerTour(routeEdges,startPeg){
 const adj=new Map();for(const e of routeEdges){if(!adj.has(e.a))adj.set(e.a,[]);if(!adj.has(e.b))adj.set(e.b,[]);adj.get(e.a).push(e);adj.get(e.b).push(e);}
 const used=new Set(),stack=[{peg:startPeg,via:null}],circuit=[];
 while(stack.length){const top=stack[stack.length-1],next=(adj.get(top.peg)||[]).find(e=>!used.has(e.id));if(next){used.add(next.id);const to=next.a===top.peg?next.b:next.a;stack.push({peg:to,via:{edge:next,from:top.peg,to}});}else{const item=stack.pop();if(item.via)circuit.push(item.via);}}
 return circuit.reverse();
}
function buildGraph(parsed,n){
 const routes=parsed.routes.slice(0,n<2?1:2),map=new Map(),graphEdges=[];
 function pegAt(p){const k=Math.round(p.x)+':'+Math.round(p.y);if(!map.has(k))map.set(k,{id:map.size,x:p.x,y:p.y,nx:p.x/W,ny:p.y/H,neighbors:[],arrows:{},pulse:0});return map.get(k);}
 const nodeSets=routes.map(route=>{const pts=route.points,clean=[];for(const p of pts){if(clean.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=50))clean.push(p);}if(clean.length>6&&Math.hypot(clean[0].x-clean[clean.length-1].x,clean[0].y-clean[clean.length-1].y)<50)clean.pop();if(clean.length<6)return pts.map(p=>pegAt(p));if(clean.length%2)clean.pop();return clean.slice(0,12).map(p=>pegAt(p));});
 if(nodeSets.length>1){let best=null;for(let i=0;i<nodeSets[0].length;i++)for(let j=0;j<nodeSets[1].length;j++){const a=nodeSets[0][i],b=nodeSets[1][j],d=Math.hypot(a.x-b.x,a.y-b.y);if(!best||d<best.d)best={i,j,a,b,d};}if(best){const shared={id:map.size,x:(best.a.x+best.b.x)/2,y:(best.a.y+best.b.y)/2,nx:(best.a.x+best.b.x)/(2*W),ny:(best.a.y+best.b.y)/(2*H),neighbors:[],arrows:{},pulse:0};nodeSets[0][best.i]=shared;nodeSets[1][best.j]=shared;}}
 const routeModels=[];
 routes.forEach((route,owner)=>{const nodes=nodeSets[owner],unique=nodes.filter((p,i)=>p!==nodes[(i+1)%nodes.length]);const routeEdges=[];
  const add=(a,b)=>{if(a===b)return;const e={id:graphEdges.length,a,b,color:route.color,owner,drawn:false,used:false,failed:false,tension:0,phase:Math.random()*TAU};graphEdges.push(e);a.neighbors.push({node:b,edge:e});b.neighbors.push({node:a,edge:e});routeEdges.push(e);};
  for(let i=0;i<unique.length;i++)add(unique[i],unique[(i+1)%unique.length]);
  // Inner polygon: adds four even-degree junctions, keeping every colour graph Eulerian.
  for(let i=0;i<unique.length;i+=2)add(unique[i],unique[(i+2)%unique.length]);
  const tour=makeEulerTour(routeEdges,unique[0]);routeModels.push({owner,color:route.color,nodes:unique,edges:routeEdges,tour});
 });
 pegs=[...new Set([...nodeSets.flat()])];edges=graphEdges;
 spiders=routeModels.map(r=>({id:r.owner,color:r.color,route:r.nodes,routeEdges:r.edges,tour:r.tour,tourCursor:0,currentPeg:r.nodes[0],from:r.nodes[0],to:null,edgeChoice:null,t:0,progress:0,x:r.nodes[0].x,y:r.nodes[0].y,nx:r.nodes[0].nx,ny:r.nodes[0].ny,angle:0,done:false,broken:false,swing:0,vy:0,hang:0,choiceIndex:0}));
 for(const s of spiders){const e=defaultEdge(s);if(e){s.edgeChoice={edge:e,node:e.a===s.currentPeg?e.b:e.a};s.angle=Math.atan2(s.edgeChoice.node.y-s.y,s.edgeChoice.node.x-s.x);}}
}
function defaultEdge(s){
 const peg=s.currentPeg;if(!peg)return null;
 for(let k=0;k<s.tour.length;k++){const i=(s.tourCursor+k)%s.tour.length,step=s.tour[i];if(step.from===peg&&!step.edge.used&&step.edge.owner===s.id){s.tourCursor=i;return step.edge;}}
 return peg.neighbors.map(v=>v.edge).find(e=>e.owner===s.id&&!e.used)||null;
}
function selectEdge(s,e){
 if(!e||e.owner!==s.id||e.color!==s.color||e.used){lose(s,e);return false;}
 s.edgeChoice={edge:e,node:e.a===s.currentPeg?e.b:e.a};s.from=s.currentPeg;s.to=s.edgeChoice.node;s.t=0;s.x=s.currentPeg.x;s.y=s.currentPeg.y;s.angle=Math.atan2(s.to.y-s.y,s.to.x-s.x);return true;
}
async function initLevel(n){const token=++loadToken;clearGame();level=Math.max(0,Math.min(levels.length-1,n));gameState=STATE.PLAYING;hud.style.display='flex';screen.style.display='none';const cfg=levels[level];levelLabel.textContent=(level<4?'ОБУЧЕНИЕ '+(level+1)+'/4':'УРОВЕНЬ '+(level+1))+' · '+cfg.name;progressText.textContent='ЗАГРУЗКА';try{const def=await loadSvg(cfg.file);if(token!==loadToken){URL.revokeObjectURL(def.url);return;}const parsed=sampleSvg(def,level<4?12:14,level<2?1:2);levelArt={...def,rect:parsed.rect};buildGraph(parsed,level);progressText.textContent='0%';localStorage.setItem('silkShapeLevel',String(level));}catch(err){if(token!==loadToken)return;gameState=STATE.LOSE;showPanel('Не удалось загрузить рисунок',String(err.message||err),'ПОВТОРИТЬ',()=>initLevel(level));}}
function totalEdges(){return spiders.reduce((a,s)=>a+s.routeEdges.length,0);}
function updateProgress(){const done=spiders.reduce((a,s)=>a+s.progress,0),v=totalEdges()?Math.min(100,Math.floor(done/totalEdges()*100)):0;progressBar.style.width=v+'%';progressText.textContent=v+'%';}
function showMenu(){const training=savedLevel<4;screen.className='menu';screen.style.display='block';screen.innerHTML='<div class="menu-brand">SILK <span>&amp; SHAPE</span></div><div class="menu-bottom"><div class="menu-status">'+(training?'ОБУЧЕНИЕ: '+(savedLevel+1)+' ИЗ 4':'УРОВЕНЬ '+(savedLevel+1)+' ИЗ 12')+'</div><div class="menu-actions"><button class="primary" id="play">'+(training?'ПРОЙТИ ОБУЧЕНИЕ':'ИГРАТЬ')+'</button><button class="secondary" id="settingsOpen">НАСТРОЙКИ</button></div></div>';document.getElementById('play').onclick=startGame;document.getElementById('settingsOpen').onclick=showSettings;loadDemo();}
function showSettings(){screen.className='modal';screen.style.display='flex';screen.innerHTML='<div class="card"><div class="eyebrow">SILK &amp; SHAPE</div><h1>Настройки</h1><p class="subtitle">Звук: '+(soundOn?'Включён':'Выключен')+'</p><button class="primary olive" id="soundToggle">ЗВУК: '+(soundOn?'ВКЛ':'ВЫКЛ')+'</button><button class="secondary" id="resetProgress">СБРОСИТЬ ПРОГРЕСС</button><button class="textButton" id="settingsBack">НАЗАД</button></div>';document.getElementById('soundToggle').onclick=()=>{soundOn=!soundOn;localStorage.setItem('silkShapeSound',soundOn?'on':'off');if(soundOn)audioInit();showSettings();};document.getElementById('resetProgress').onclick=()=>{if(confirm('Сбросить прогресс и начать с обучения?')){savedLevel=0;localStorage.setItem('silkShapeLevel','0');showMenu();}};document.getElementById('settingsBack').onclick=showMenu;}
function showPanel(title,sub,button,fn){screen.innerHTML='<div class="card"><div class="eyebrow">SILK &amp; SHAPE · МАСТЕРСКАЯ</div><h1>'+title+'</h1><p class="subtitle">'+sub+'</p><button class="primary" id="panelAction">'+button+'</button></div>';screen.className='modal';screen.style.display='flex';document.getElementById('panelAction').onclick=fn;}
async function startGame(){if(gameState!==STATE.MENU)return;destroyDemo();audioInit();await initLevel(savedLevel);}
function goHome(){++loadToken;clearGame();gameState=STATE.MENU;hud.style.display='none';screen.style.display='block';showMenu();}
async function nextLevel(){screen.style.display='none';if(level>=levels.length-1){goHome();return;}savedLevel=Math.min(levels.length-1,level+1);localStorage.setItem('silkShapeLevel',String(savedLevel));await initLevel(savedLevel);}
function win(){if(gameState!==STATE.PLAYING)return;gameState=STATE.WIN;reveal=0;winElapsed=0;fireworksStarted=false;particles=[];screen.style.display='none';savedLevel=Math.min(levels.length-1,level+1);localStorage.setItem('silkShapeLevel',String(savedLevel));}
function showWinPanel(){if(level===levels.length-1)showPanel('Все узоры готовы!','Ты сплёл все 12 рисунков.','В МЕНЮ',goHome);else if(level===3)showPanel('Обучение пройдено!','Теперь открыты все рисунки.','СЛЕДУЮЩИЙ УРОВЕНЬ',nextLevel);else showPanel('Узор готов!','Оригинальная иллюстрация проявилась сквозь нити.','СЛЕДУЮЩИЙ УРОВЕНЬ',nextLevel);}
function startFireworks(){fireworksStarted=true;chord();const colors=['#D9534F','#2A9D8F','#477DA8','#E9C46A','#C85A32','#8C6BB1','#588157'];for(let b=0;b<6;b++){const ox=W*(.18+Math.random()*.64),oy=H*(.2+Math.random()*.48);for(let i=0;i<24;i++){const a=TAU*i/24+Math.random()*.1,sp=48+Math.random()*115;particles.push({x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1.3+Math.random()*.5,color:colors[(i+b)%colors.length],r:1.5+Math.random()*3});}}}
function lose(s,e){if(gameState!==STATE.PLAYING)return;gameState=STATE.LOSE;loseElapsed=0;s.broken=true;s.hang=0;s.vy=10;if(e)e.failed=true;for(let i=0;i<28;i++){const a=Math.random()*TAU,r=2+Math.random()*9;s.tangle??=[];s.tangle.push({a,r,phase:Math.random()*TAU});}for(let i=0;i<22;i++)particles.push({x:s.x,y:s.y,vx:(Math.random()-.5)*100,vy:(Math.random()-.7)*100,life:1,color:'#C7433E',r:Math.random()*3+1});}
function tap(x,y){
 if(gameState!==STATE.PLAYING)return;let hit=null,dist=1e9;for(const p of pegs){const d=Math.hypot(x-p.x,y-p.y);if(d<Math.max(27,W*.065)&&d<dist){hit=p;dist=d;}}if(!hit)return;
 const s=spiders.find(v=>!v.done&&!v.broken&&v.currentPeg===hit);if(!s)return;
 const options=hit.neighbors; if(!options.length){lose(s,null);return;}
 const current=s.edgeChoice?.edge||hit.arrows[s.id],idx=options.findIndex(v=>v.edge===current);
 const next=options[(idx+1+options.length)%options.length];hit.arrows[s.id]=next.edge;hit.pulse=1;pluck(s.id);selectEdge(s,next.edge);
}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();tap(e.clientX-r.left,e.clientY-r.top);});
document.getElementById('home').onclick=goHome;
document.getElementById('restart').onclick=()=>{if(gameState===STATE.PLAYING||gameState===STATE.LOSE)initLevel(level);};
function updateGame(dt){
 if(gameState===STATE.LOSE){loseElapsed+=dt;for(const s of spiders)if(s.broken){s.hang+=dt;s.vy+=100*dt;s.y=Math.min(H*.82,s.y+s.vy*dt);s.x+=Math.sin(s.hang*3.2)*12*dt;s.swing=Math.sin(s.hang*3.5)*.32;}particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=120*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);if(loseElapsed>1.05&&screen.style.display==='none')showPanel('Засада! Нить запуталась','Жучок выбрал чужую или уже сплетённую нить.','ЗАНОВО',()=>initLevel(level));return;}
 if(gameState===STATE.WIN){winElapsed+=dt;reveal=Math.min(1,winElapsed/1.5);if(winElapsed>=1.5&&!fireworksStarted)startFireworks();if(fireworksStarted){particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=95*dt;p.vx*=.992;p.life-=dt;});particles=particles.filter(p=>p.life>0);}if(winElapsed>=2.5&&screen.style.display==='none')showWinPanel();return;}
 if(gameState!==STATE.PLAYING)return;
 for(const p of pegs)p.pulse=Math.max(0,p.pulse-dt*2.5);for(const e of edges)e.tension=Math.max(0,e.tension-dt*2.7);
 for(const s of spiders){if(s.done||s.broken)continue;
  if(!s.edgeChoice){const e=defaultEdge(s);if(!e){lose(s,null);return;}if(!selectEdge(s,e))return;}
  const e=s.edgeChoice.edge,from=s.currentPeg,to=s.edgeChoice.node;if(e.used||e.owner!==s.id||e.color!==s.color){lose(s,e);return;}
  const dx=to.x-from.x,dy=to.y-from.y,dist=Math.hypot(dx,dy)||1,ang=Math.atan2(dy,dx);let diff=((ang-s.angle+Math.PI*3)%TAU)-Math.PI;s.angle+=diff*Math.min(1,dt*12);
  s.t=Math.min(1,s.t+levels[level].speed*dt/dist);s.x=from.x+dx*s.t;s.y=from.y+dy*s.t;
  if(s.t>=1){e.used=true;e.drawn=true;e.tension=1;s.progress++;s.currentPeg=to;s.x=to.x;s.y=to.y;s.nx=to.nx;s.ny=to.ny;s.from=from;s.to=to;s.t=0;s.edgeChoice=null;pluck(s.id);
   if(s.progress>=s.routeEdges.length){s.done=true;s.x=to.x;s.y=to.y;}
   else{const next=defaultEdge(s);if(next){const idx=to.neighbors.findIndex(v=>v.edge===next);to.arrows[s.id]=next; s.choiceIndex=idx;}else{lose(s,null);return;}}
   updateProgress();
  }
 }
 if(edges.length&&edges.every(e=>e.used)){progressBar.style.width='100%';progressText.textContent='100%';win();}
}
function yarn(a,b,color,width=4,phase=0,sag=0,vibe=0,alpha=1){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,mid={x:(a.x+b.x)/2+nx*(sag+Math.sin(time*5+phase)*2),y:(a.y+b.y)/2+ny*(sag+Math.sin(time*5+phase)*2)+sag*.22};const wave=vibe*Math.sin(time*34+phase)*3;mid.x+=nx*wave;mid.y+=ny*wave;ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(a.x+1.5,a.y+3);ctx.quadraticCurveTo(mid.x+1.5,mid.y+3,b.x+1.5,b.y+3);ctx.strokeStyle='rgba(54,39,26,.25)';ctx.lineWidth=width+5;ctx.stroke();const grad=ctx.createLinearGradient(a.x,a.y,b.x,b.y);grad.addColorStop(0,'#fff4dd');grad.addColorStop(.35,color);grad.addColorStop(.75,color);grad.addColorStop(1,'#fff0d2');ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(mid.x,mid.y,b.x,b.y);ctx.strokeStyle=grad;ctx.lineWidth=width;ctx.stroke();ctx.beginPath();ctx.moveTo(a.x,a.y-1);ctx.quadraticCurveTo(mid.x,mid.y-1,b.x,b.y-1);ctx.strokeStyle='rgba(255,250,232,.58)';ctx.lineWidth=Math.max(1,width*.2);ctx.stroke();ctx.restore();}
function drawPeg(p,alpha=1){
 ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y);ctx.fillStyle='rgba(75,55,35,.24)';ctx.beginPath();ctx.ellipse(2,8,13,7,0,0,TAU);ctx.fill();ctx.fillStyle='#8B775E';ctx.beginPath();ctx.ellipse(0,4,7,10,0,0,TAU);ctx.fill();
 const shaft=ctx.createLinearGradient(-7,0,7,0);shaft.addColorStop(0,'#8E6847');shaft.addColorStop(.35,'#E4C49A');shaft.addColorStop(.7,'#B58B61');shaft.addColorStop(1,'#76553B');ctx.fillStyle=shaft;ctx.beginPath();ctx.roundRect(-5,-3,10,12,3);ctx.fill();
 const head=ctx.createRadialGradient(-4,-6,1,0,-1,12);head.addColorStop(0,'#FFF0D1');head.addColorStop(.38,'#D9B78D');head.addColorStop(.78,'#A77A50');head.addColorStop(1,'#6D4B32');ctx.fillStyle=head;ctx.strokeStyle='#705139';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,-3,10,7.5,0,0,TAU);ctx.fill();ctx.stroke();ctx.strokeStyle='rgba(255,245,220,.8)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(-1,-4,6,-.2,2.6);ctx.stroke();ctx.fillStyle='#63452F';ctx.beginPath();ctx.ellipse(0,-3,2.3,1.4,0,0,TAU);ctx.fill();
 const active=spiders.find(s=>!s.done&&!s.broken&&s.currentPeg===p);if(active){const edge=active.edgeChoice?.edge||p.arrows[active.id],n=edge?p.neighbors.find(v=>v.edge===edge):null;if(n){const a=Math.atan2(n.node.y-p.y,n.node.x-p.x);ctx.rotate(a);ctx.fillStyle='#fff7e8';ctx.strokeStyle='#68482F';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(29,-1);ctx.lineTo(13,-8);ctx.lineTo(17,-1);ctx.lineTo(13,6);ctx.closePath();ctx.fill();ctx.stroke();}}
 ctx.restore();
}
function drawBug(s){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle+(s.swing||0));const color=s.color;ctx.strokeStyle='#594737';ctx.lineWidth=1.7;ctx.lineCap='round';for(let i=0;i<3;i++)for(const side of [-1,1]){const y=side*(2+i*2.1),kick=Math.sin(time*19+i*1.8+(side>0?Math.PI:0))*3.2;ctx.beginPath();ctx.moveTo(-2+i*2,y*.35);ctx.lineTo(-5+i*2,y+kick*.45);ctx.lineTo(-8+i*2,y+side*(5+Math.abs(kick)));ctx.stroke();}ctx.fillStyle='rgba(75,55,39,.2)';ctx.beginPath();ctx.ellipse(-2,2,8,5.7,0,0,TAU);ctx.fill();ctx.fillStyle=color;ctx.strokeStyle='#594737';ctx.lineWidth=1.15;ctx.beginPath();ctx.ellipse(-1,0,8.5,5.6,0,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#594737';ctx.beginPath();ctx.arc(7,0,3.5,0,TAU);ctx.fill();ctx.fillStyle='#fff8e9';ctx.beginPath();ctx.arc(8.2,-1.2,.8,0,TAU);ctx.arc(8.2,1.2,.8,0,TAU);ctx.fill();ctx.strokeStyle='#594737';ctx.beginPath();ctx.moveTo(8,-2);ctx.quadraticCurveTo(11,-7,14,-6);ctx.moveTo(8,2);ctx.quadraticCurveTo(11,7,14,6);ctx.stroke();ctx.restore();}
function drawTangle(s){if(!s.tangle)return;ctx.save();ctx.translate(s.x,s.y);for(let i=0;i<7;i++){ctx.beginPath();for(let j=0;j<=30;j++){const a=j/30*TAU*2+i*.8,r=5+Math.sin(a*2+i)*4;const x=Math.cos(a)*r,y=Math.sin(a)*r; if(!j)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle=i%2?s.color:'#C85A32';ctx.lineWidth=2.2;ctx.stroke();}ctx.restore();if(s.from)yarn(s.from,{x:s.x,y:s.y-2},s.color,2.6,1,0,0,1);}
function drawArt(alpha){if(!levelArt||!levelArt.image.complete)return;const r=levelArt.rect;ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(levelArt.image,r.x,r.y,r.w,r.h);ctx.restore();}
function drawGame(){
 for(const e of edges){if(e.used)yarn(e.a,e.b,e.color,4.5,e.phase,0,e.tension,1);else{ctx.save();ctx.setLineDash([2.5,7]);ctx.lineDashOffset=-time*5;ctx.strokeStyle=e.color;ctx.globalAlpha=.7;ctx.lineWidth=2.4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(e.a.x,e.a.y);ctx.lineTo(e.b.x,e.b.y);ctx.stroke();ctx.restore();}}
 for(const s of spiders)if(s.edgeChoice&&s.t>0&&!s.broken)yarn(s.currentPeg,{x:s.x,y:s.y},s.color,4.3,s.id*2.3,9,0,1);
 const pegAlpha=gameState===STATE.WIN?1-reveal:1;pegs.forEach(p=>drawPeg(p,pegAlpha));
 spiders.forEach(s=>{if(s.broken)drawTangle(s);drawBug(s);});
 if(gameState===STATE.WIN)drawArt(reveal);
}
function drawBackground(){ctx.fillStyle=PAPER;ctx.fillRect(0,0,W,H);const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'rgba(255,255,255,.25)');g.addColorStop(1,'rgba(176,146,108,.07)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.save();grain.forEach(q=>{ctx.globalAlpha=q.a;ctx.fillStyle='#9b8366';ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,TAU);ctx.fill();});ctx.restore();ctx.strokeStyle='rgba(128,101,72,.07)';ctx.strokeRect(12,12,W-24,H-24);}
function drawTutorial(){const cfg=levels[level],s=spiders.find(v=>!v.done);if(!cfg.tutorial||!s)return;const w=Math.min(W-34,350),x=(W-w)/2,y=70;ctx.fillStyle='rgba(255,250,240,.86)';ctx.strokeStyle='rgba(178,153,122,.7)';ctx.beginPath();ctx.roundRect(x,y,w,43,13);ctx.fill();ctx.stroke();ctx.fillStyle=INK;ctx.font='700 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(cfg.tutorial,W/2,y+22,w-18);if(s.waiting){ctx.strokeStyle='rgba(200,90,50,.8)';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(s.x,s.y,17+Math.sin(time*5)*3,0,TAU);ctx.stroke();}}
function drawParticles(){particles.forEach(p=>{ctx.save();ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.translate(p.x,p.y);ctx.rotate(time*5);ctx.fillRect(-p.r,-p.r*.55,p.r*2,p.r*1.1);ctx.restore();});}
async function loadDemo(){
 if(demo.loading||demo.ready)return;demo.loading=true;
 try{const def=await loadSvg(levels[0].file);const parsed=sampleSvg(def,8,1),pts=parsed.routes[0].points,local=[],routeEdges=[];
  pts.forEach(p=>local.push({id:local.length,x:p.x,y:p.y,nx:p.x/W,ny:p.y/H,neighbors:[],arrows:{},pulse:0}));
  const add=(a,b)=>{const e={id:routeEdges.length,a,b,color:parsed.routes[0].color,owner:0,drawn:false,used:false,tension:0,phase:routeEdges.length};routeEdges.push(e);a.neighbors.push({node:b,edge:e});b.neighbors.push({node:a,edge:e});};
  for(let i=0;i<local.length;i++)add(local[i],local[(i+1)%local.length]);for(let i=0;i<local.length;i+=2)add(local[i],local[(i+2)%local.length]);
  const tour=makeEulerTour(routeEdges,local[0]);demo.art={...def,rect:parsed.rect};demo.pegs=local;demo.edges=routeEdges;demo.bugs=[{id:0,color:parsed.routes[0].color,x:local[0].x,y:local[0].y,nx:local[0].nx,ny:local[0].ny,angle:0,currentPeg:local[0],edgeChoice:null,t:0,progress:0,tour,tourCursor:0,done:false}];demo.phase='draw';demo.ready=true;
 }catch(e){demo.ready=false;}finally{demo.loading=false;}
}
function updateDemo(dt){
 if(gameState!==STATE.MENU||!demo.ready)return;const b=demo.bugs[0];
 if(demo.phase==='draw'){if(!b.edgeChoice){const step=b.tour.find(v=>!v.edge.used);if(!step){b.done=true;demo.phase='hold';demo.hold=0;return;}const from=b.currentPeg;let found=null;for(let k=0;k<b.tour.length;k++){const i=(b.tourCursor+k)%b.tour.length,v=b.tour[i];if(v.from===from&&!v.edge.used){found={...v,index:i};break;}}if(!found){demo.phase='hold';demo.hold=0;return;}b.edgeChoice={edge:found.edge,node:found.to};b.tourCursor=found.index;}
 const from=b.currentPeg,to=b.edgeChoice.node,dist=Math.hypot(to.x-from.x,to.y-from.y)||1;b.t=Math.min(1,b.t+dt*65/dist);b.x=from.x+(to.x-from.x)*b.t;b.y=from.y+(to.y-from.y)*b.t;b.nx=b.x/W;b.ny=b.y/H;b.angle=Math.atan2(to.y-from.y,to.x-from.x);
 if(b.t>=1){b.edgeChoice.edge.used=true;b.edgeChoice.edge.drawn=true;b.currentPeg=to;b.progress++;b.t=0;b.edgeChoice=null;if(b.progress>=demo.edges.length){b.done=true;demo.phase='hold';demo.hold=0;}}}
 else if(demo.phase==='hold'){demo.hold+=dt;demo.reveal=Math.min(1,demo.hold/.5);if(demo.hold>1.65){demo.phase='fade';demo.fade=0;}}
 else if(demo.phase==='fade'){demo.fade=Math.min(1,demo.fade+dt/1.1);if(demo.fade>=1){if(demo.art?.url)URL.revokeObjectURL(demo.art.url);demo.ready=false;demo.bugs=[];demo.pegs=[];demo.edges=[];demo.art=null;demo.hold=0;demo.fade=0;demo.reveal=0;loadDemo();}}
}
function drawDemo(){
 if(!demo.ready){if(!demo.loading)loadDemo();return;}const b=demo.bugs[0],alpha=1-demo.fade;
 for(const e of demo.edges){if(e.used)yarn(e.a,e.b,e.color,4,e.phase,0,0,alpha);else{ctx.save();ctx.globalAlpha=.6*alpha;ctx.setLineDash([2,6]);ctx.strokeStyle=e.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(e.a.x,e.a.y);ctx.lineTo(e.b.x,e.b.y);ctx.stroke();ctx.restore();}}
 if(b.edgeChoice&&b.t>0)yarn(b.currentPeg,{x:b.x,y:b.y},b.color,4,0,8,0,alpha);
 demo.pegs.forEach(p=>drawPeg(p,alpha));if(!b.done)drawBug(b);
 if(demo.art){ctx.save();ctx.globalAlpha=alpha*demo.reveal;const r=demo.art.rect;ctx.drawImage(demo.art.image,r.x,r.y,r.w,r.h);ctx.restore();}
}
function draw(){drawBackground();if(gameState===STATE.MENU)drawDemo();else{drawGame();if(gameState===STATE.PLAYING&&level<4)drawTutorial();drawParticles();}}
function update(dt){time+=dt;if(gameState===STATE.MENU){updateDemo(dt);return;}updateGame(dt);}
function frame(ts){const dt=Math.min(.04,(ts-last)/1000||0);last=ts;update(dt);draw();requestAnimationFrame(frame);}
function destroyDemo(){demo.ready=false;demo.loading=false;if(demo.art&&demo.art.url)URL.revokeObjectURL(demo.art.url);demo.bugs=[];demo.pegs=[];demo.edges=[];demo.art=null;demo.phase='draw';demo.hold=0;demo.fade=0;demo.reveal=0;}
resize();showMenu();requestAnimationFrame(frame);
})();