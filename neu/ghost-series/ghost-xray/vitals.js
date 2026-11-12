import {t} from './ui.js?v=0.2.1';
import {placeCard} from './layout.js?v=0.2.1';
export function drawDetection(g,{head:h},W,H,screenX,mirror){
 const b=h.box;if(!b)return;g.save();g.strokeStyle='#e5b26f';g.fillStyle='#e5b26f';g.lineWidth=1;g.font='10px Consolas,monospace';
 const x=screenX(mirror?b.left+b.w:b.left),y=b.top*H;
 g.strokeRect(x,y,b.w*W,b.h*H);g.fillText(`SUBJ ${String(h.id+1).padStart(2,'0')} · ${(b.w*100).toFixed(1)}%`,x,Math.max(12,y-6));g.restore();
}
export function drawVitals(g,actor,now,S,W,H,screenX,headBounds,occupied){
 const h=actor.head,b=h.box,v=h.vitals;if(!b)return;
 if(now>=v.next){v.hr=Math.max(58,Math.min(105,v.hr+(Math.random()-.5)*4));v.rr=Math.max(11,Math.min(22,v.rr+(Math.random()-.5)));v.o2=Math.max(95,Math.min(99,v.o2+(Math.random()-.5)*.4));v.temp=Math.max(36,Math.min(37.3,v.temp+(Math.random()-.5)*.08));v.next=now+900+Math.random()*1100;}
 const boxW=Math.min(160,Math.max(105,W/S.maxFaces*.62)),boxH=112;
 const preferred=screenX(b.x)+(S.mirror?-(b.w*W*.8+8+boxW):(b.w*W*.8+8));
 const rect=placeCard({x:preferred,y:b.top*H},boxW,boxH,W,H,headBounds,occupied,h.card);
 if(!rect){h.card=null;return;}
 h.card=rect;occupied.push(rect);const {x,y}=rect;
 g.save();g.globalAlpha=S.vitalsOpacity*h.opacity;g.translate(x,y);
 g.fillStyle='rgba(8,13,17,.8)';g.fillRect(0,0,boxW,boxH);g.strokeStyle='rgba(124,200,219,.28)';g.strokeRect(.5,.5,boxW-1,boxH-1);
 g.font='9px Consolas, "Microsoft YaHei",monospace';g.fillStyle='#7cc8db';g.fillText(`SUBJ ${String(h.id+1).padStart(2,'0')} / SIM`,8,14);
 g.fillStyle='#7fd1a8';g.font='bold 18px Consolas,monospace';g.fillText(`${Math.round(v.hr)}`,8,37);g.font='9px Consolas,monospace';g.fillStyle='#a1a1aa';g.fillText('BPM',42,36);
 g.fillText(`RR ${Math.round(v.rr)}  SpO2 ${v.o2.toFixed(0)}%`,8,53);g.fillText(`TEMP ${v.temp.toFixed(1)}°C`,8,67);
 g.strokeStyle='#7fd1a8';g.lineWidth=1;g.beginPath();
 for(let px=7;px<boxW-7;px++){
  const phase=((px/52+now/60000*v.hr+v.phase)%1+1)%1;
  const pulse=Math.exp(-Math.pow((phase-.52)/.025,2))*12-Math.exp(-Math.pow((phase-.47)/.04,2))*4-Math.exp(-Math.pow((phase-.57)/.035,2))*5+Math.sin(phase*Math.PI*2)*1.3;
  const yy=85-pulse;px===7?g.moveTo(px,yy):g.lineTo(px,yy);
 }g.stroke();g.fillStyle='#71717a';g.font='8px Consolas,"Microsoft YaHei",monospace';g.fillText(t('SIMULATED DATA'),8,104);g.restore();
}
