import {t} from './ui.js?v=0.3.0';
import {placeCard} from './layout.js?v=0.3.0';
export function drawDetection(g,{head:h},W,H,screenX,mirror){
 const b=h.box;if(!b)return;g.save();g.strokeStyle='#e5b26f';g.fillStyle='#e5b26f';g.lineWidth=1;g.font='10px Consolas,monospace';
 const x=screenX(mirror?b.left+b.w:b.left),y=b.top*H;
 g.strokeRect(x,y,b.w*W,b.h*H);g.fillText(`SUBJ ${String(h.id+1).padStart(2,'0')} · ${(b.w*100).toFixed(1)}%${h.anom?` · ${h.anom.ph} ${(h.anom.k*100|0)}%`:''}`,x,Math.max(12,y-6));g.restore();
}
export function drawVitals(g,actor,now,S,W,H,screenX,headBounds,occupied){
 const h=actor.head,b=h.box,v=h.vitals;if(!b)return;
 if(now>=v.next){v.hr=Math.max(58,Math.min(105,v.hr+(Math.random()-.5)*4));v.rr=Math.max(11,Math.min(22,v.rr+(Math.random()-.5)));v.o2=Math.max(95,Math.min(99,v.o2+(Math.random()-.5)*.4));v.temp=Math.max(36,Math.min(37.3,v.temp+(Math.random()-.5)*.08));v.next=now+900+Math.random()*1100;}
 const boxW=Math.min(160,Math.max(105,W/S.maxFaces*.62)),boxH=112;
 const preferred=screenX(b.x)+(S.mirror?-(b.w*W*.8+8+boxW):(b.w*W*.8+8));
 const rect=placeCard({x:preferred,y:b.top*H},boxW,boxH,W,H,headBounds,occupied,h.card);
 if(!rect){h.card=null;return;}
 h.card=rect;occupied.push(rect);const {x,y}=rect;
 // 异常剧情：w 0→1 体征越来越不对；dead = 显形 / 断讯，无生命体征
 const a=h.anom,w=!a?0:a.ph==='calm'?0:a.ph==='wrong'?a.k:1,dead=!!a&&(a.ph==='reveal'||a.ph==='drop');
 const dt=Math.min(.2,Math.max(0,(now-(v.at||now))/1000));v.at=now;
 if(v.beat===undefined)v.beat=v.phase||0;
 // 心率：先变慢，后半段乱跳（偶尔猛地蹿高），显形后归零
 let hr=v.hr*(1-.78*w);if(w>.35&&Math.random()<.02*w)v.spike=now+300;if(now<(v.spike||0))hr=hr*2.4+40;if(dead)hr=0;
 v.shown=hr;v.beat+=dt*hr/60;
 const temp=v.temp-w*13.5-(dead?(now%60000)/60000*2:0),o2=v.o2-w*31,rr=v.rr*(1-.8*w);
 const mix=(p,q,k)=>`rgb(${p.map((c,i)=>Math.round(c+(q[i]-c)*k)).join(',')})`;
 const ok=[127,209,168],bad=[229,72,77],col=mix(ok,bad,Math.min(1,w*1.3)),blink=(now/380|0)%2;
 g.save();g.globalAlpha=S.vitalsOpacity*h.opacity;g.translate(x,y);
 g.fillStyle=dead?'rgba(24,6,7,.86)':'rgba(8,13,17,.8)';g.fillRect(0,0,boxW,boxH);g.strokeStyle=w>.5?`rgba(229,72,77,${.35+.4*w})`:'rgba(124,200,219,.28)';g.strokeRect(.5,.5,boxW-1,boxH-1);
 g.font='9px Consolas, "Microsoft YaHei",monospace';g.fillStyle=w>.5?'#e5484d':'#7cc8db';g.fillText(`SUBJ ${String(h.id+1).padStart(2,'0')} / ${w>.5?'ANOMALY':'SIM'}`,8,14);
 if(dead){
  g.fillStyle=blink?'#e5484d':'#7f1d1d';g.font='bold 13px Consolas,"Microsoft YaHei",monospace';g.fillText(t('NO VITAL SIGNS'),8,36);
  g.font='9px Consolas,monospace';g.fillStyle='#a1a1aa';g.fillText(`HR 0  RR 0  SpO2 --`,8,53);g.fillStyle='#e5484d';g.fillText(`TEMP ${temp.toFixed(1)}°C`,8,67);
 }else{
  g.fillStyle=col;g.font='bold 18px Consolas,monospace';g.fillText(`${Math.round(hr)}`,8,37);g.font='9px Consolas,monospace';g.fillStyle='#a1a1aa';g.fillText('BPM',42,36);
  g.fillText(`RR ${Math.round(rr)}  SpO2 ${Math.max(0,o2).toFixed(0)}%`,8,53);g.fillStyle=w>.3?col:'#a1a1aa';g.fillText(`TEMP ${temp.toFixed(1)}°C`,8,67);
 }
 // 波形：心跳越慢波峰越稀；异常时幅度乱变；死后一条平线（带一点噪声）
 g.strokeStyle=dead?'#e5484d':col;g.lineWidth=1;g.beginPath();
 for(let px=7;px<boxW-7;px++){
  const phase=((px/52-v.beat)%1+1)%1,amp=dead?0:1-.55*w+(w>.3?Math.sin(px*.7+now/90)*.35*w:0);
  const pulse=(Math.exp(-Math.pow((phase-.52)/.025,2))*12-Math.exp(-Math.pow((phase-.47)/.04,2))*4-Math.exp(-Math.pow((phase-.57)/.035,2))*5+Math.sin(phase*Math.PI*2)*1.3)*amp+(dead?(Math.random()-.5)*.8:0);
  const yy=85-pulse;px===7?g.moveTo(px,yy):g.lineTo(px,yy);
 }g.stroke();g.fillStyle='#71717a';g.font='8px Consolas,"Microsoft YaHei",monospace';g.fillText(t('SIMULATED DATA'),8,104);g.restore();
}
