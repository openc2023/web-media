import {seeded} from './proximity.js?v=0.3';
// 眼睛布局：大眼先放、小眼补缝，铺满整个画面（边上的可以出画），中间留一块空洞透出后面的空间。
// 同一个随机种子 + 同一画面尺寸 → 同样的布局。
export class EyeField{
 constructor(sets){this.sets=sets;this.eyes=[];this.previousClosed=null;this.last=0;this.layoutKey=null;this.maskDirty=true;this.W=1280;this.H=720;}
 rebuild(cfg,now=performance.now()){this.layout(this.W,this.H,cfg,now);}
 aspect(){const r=this.sets.map(s=>s.bounds.height/s.bounds.width);return r.reduce((a,b)=>a+b,0)/r.length;}
 layout(W,H,cfg,now=performance.now()){
  this.W=W;this.H=H;this.layoutKey=this.key(W,H,cfg);this.maskDirty=true;
  const random=seeded(cfg.layoutSeed),asp=this.aspect(),base=Math.sqrt(W*H/cfg.count)*cfg.eyeScale;
  // 尺寸分布：少数很大、多数中等、一些小的
  const sizes=Array.from({length:cfg.count},()=>base*Math.max(.32,1+(Math.pow(random(),2.4)*2.6-.62)*cfg.sizeVariation)).sort((a,b)=>b-a);
  const gx=W*.24*cfg.gap,gy=H*.24*cfg.gap,need=.9+cfg.eyeSpacing*.8-cfg.overlap;
  const placed=[];
  for(let w of sizes){
   let ok=null;
   for(let shrink=0;shrink<4&&!ok;shrink++,w*=.84){
    const h=w*asp;
    for(let tries=0;tries<70;tries++){
     const x=-W*.04+random()*W*1.08,y=-H*.05+random()*H*1.1;
     const ge=gx>0?((x-W/2)/gx)**2+((y-H*.47)/gy)**2:9;
     if(ge<1&&!(w<base*.75&&random()<.12))continue;            // 中间的空洞，只偶尔漏进一两只小眼
     if(placed.every(e=>Math.hypot((x-e.px)/((w+e.width)/2),(y-e.py)/((h+e.height)/2))>=need)){ok={px:x,py:y,width:w,height:h};break;}
    }
   }
   if(ok)placed.push(ok);
  }
  this.eyes=placed.map((e,i)=>({x:e.px/W,y:e.py/H,px:e.px,py:e.py,width:e.width,height:e.height,angle:(random()-.5)*2,type:random()<cfg.eyeMix?1:0,
   random:seeded(i*7919+cfg.layoutSeed),p:random()<.7?1:0,target:true,next:now+random()*cfg.openDelay*1000,delay:0,phase:random()*6.28}));
  this.previousClosed=null;
 }
 key(W,H,cfg){return [Math.round(W),Math.round(H),cfg.count,cfg.layoutSeed,cfg.eyeScale,cfg.sizeVariation,cfg.eyeSpacing,cfg.overlap,cfg.gap,cfg.eyeMix].join('/');}
 // 肉膜 mask：R = 整体覆盖（中间挖空），G = 每只眼睛周围鼓起的眼眶
 drawMask(g,mw,mh,cfg){
  const sx=mw/this.W,sy=mh/this.H;g.save();g.globalCompositeOperation='source-over';
  const v=Math.round(255*cfg.fleshCover);g.fillStyle=`rgb(${v},0,0)`;g.fillRect(0,0,mw,mh);
  if(cfg.gap>0){g.save();g.translate(mw/2,mh*.47);g.scale(1,(this.H*.24)/(this.W*.24)*sy/sx);const r=this.W*.24*cfg.gap*sx*1.25,gr=g.createRadialGradient(0,0,r*.05,0,0,r);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,6.3);g.fill();g.restore();}
  g.globalCompositeOperation='lighter';
  for(const e of this.eyes){
   g.save();g.translate(e.px*sx,e.py*sy);g.rotate(e.angle*cfg.rotationSpread*Math.PI/180);g.scale(1,e.height/e.width*1.25);
   const r=e.width*sx*.68,gr=g.createRadialGradient(0,0,r*.2,0,0,r);gr.addColorStop(0,'rgba(0,255,0,.95)');gr.addColorStop(.6,'rgba(0,170,0,.6)');gr.addColorStop(1,'rgba(0,0,0,0)');
   g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,6.3);g.fill();g.restore();
  }
  g.restore();this.maskDirty=false;
 }
 draw(g,W,H,now,closed,cfg){
  const dt=Math.min(.1,this.last?(now-this.last)/1000:1/30);this.last=now;g.clearRect(0,0,W,H);
  if(this.layoutKey!==this.key(W,H,cfg))this.layout(W,H,cfg,now);
  if(closed!==this.previousClosed){for(const e of this.eyes){if(closed){e.delay=now+e.random()*180;e.next=Infinity;}else{e.next=now+e.random()*cfg.openDelay*1000;e.target=false;}}this.previousClosed=closed;}
  g.globalAlpha=cfg.eyeOpacity; // 亮度/饱和度在合成着色器里统一调（逐只 canvas filter 太慢）
  for(const e of this.eyes){
   if(closed){if(now>=e.delay)e.target=false;}
   else if(now>=e.next){e.target=!e.target;e.next=now+(e.target ? .8+e.random()*cfg.blinkInterval : .25+e.random()*cfg.openDelay)*1000;}
   e.p=Math.max(0,Math.min(1,e.p+(e.target?dt/cfg.openDuration:-dt/cfg.closeDuration)));
   const index=e.p<=0?3:e.p>=1?7:e.target?Math.min(7,3+Math.round(e.p*4)):Math.min(3,Math.round((1-e.p)*3));
   const set=this.sets[e.type],b=set.bounds;
   // 轻微的呼吸起伏（像活的肉）
   const breathe=1+Math.sin(now*.0011+e.phase)*.012;
   g.save();g.translate(e.x*W+Math.sin(now*.00013+e.phase)*1.5,e.y*H);g.rotate(e.angle*cfg.rotationSpread*Math.PI/180);
   g.drawImage(set.frames[index],b.left,b.top,b.width,b.height,-e.width*breathe/2,-e.height*breathe/2,e.width*breathe,e.height*breathe);g.restore();
  }g.globalAlpha=1;
 }
}
