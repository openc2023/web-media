export function createAtmosphere(S,stage,source,save){
 const canvas=document.createElement('canvas');canvas.id='atmosphere';document.getElementById('gl').after(canvas);
 const g=canvas.getContext('2d'),noise=document.createElement('canvas');noise.width=noise.height=128;
 const ng=noise.getContext('2d'),data=ng.createImageData(128,128);let nextNoise=0,nextTear=0,tearUntil=0,tearY=0;
 const keys=['cameraSaturation','cameraExposure','cameraContrast','warmth','softness','grain','scanlines','vignette','interference'];
 const presets={gray:[.1,.9,1.15,0,0,.2,.2,.45,.15],vintage:[.75,.95,1.05,.35,.3,.2,.15,.35,.2],clean:[1,1,1,0,0,0,0,0,0]};
 const look=document.getElementById('cameraLook');look.value=S.cameraLook;
 function filter(){source.style.filter=`sepia(${S.warmth*.7}) saturate(${S.cameraSaturation}) brightness(${S.cameraExposure}) contrast(${S.cameraContrast}) blur(${S.softness*.8}px)`;}
 for(const key of keys){const e=document.getElementById(key);e.value=S[key];e.addEventListener('input',()=>{S[key]=Number(e.value);S.cameraLook='custom';look.value='custom';save();filter();});}
 look.onchange=()=>{S.cameraLook=look.value;const preset=presets[look.value];if(preset)keys.forEach((key,i)=>{S[key]=preset[i];document.getElementById(key).value=S[key];});save();filter();document.dispatchEvent(new Event('xray-sync'));};
 const overlay=document.getElementById('cameraOverlay');overlay.checked=S.cameraOverlay;overlay.onchange=()=>{S.cameraOverlay=overlay.checked;save();};filter();
 function draw(now,W,H,demo){
  if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
  g.clearRect(0,0,W,H);
  if(S.warmth>0){g.fillStyle=`rgba(166,110,55,${S.warmth*.055})`;g.fillRect(0,0,W,H);}
  if(S.grain>0){
   if(now>nextNoise){for(let i=0;i<data.data.length;i+=4){const v=Math.random()*255;data.data[i]=data.data[i+1]=data.data[i+2]=v;data.data[i+3]=255;}ng.putImageData(data,0,0);nextNoise=now+80;}
   g.globalAlpha=S.grain*.16;g.fillStyle=g.createPattern(noise,'repeat');g.fillRect(0,0,W,H);g.globalAlpha=1;
  }
  if(S.scanlines>0){g.fillStyle=`rgba(0,0,0,${S.scanlines*.5})`;for(let y=0;y<H;y+=4)g.fillRect(0,y,W,1);}
  if(S.vignette>0){const v=g.createRadialGradient(W/2,H*.46,Math.min(W,H)*.24,W/2,H/2,Math.hypot(W,H)*.56);v.addColorStop(0,'transparent');v.addColorStop(1,`rgba(0,0,0,${S.vignette*.85})`);g.fillStyle=v;g.fillRect(0,0,W,H);}
  if(S.interference>0&&now>=nextTear){tearY=Math.random()*H;tearUntil=now+70+Math.random()*90;nextTear=now+1200+(1-S.interference)*9000+Math.random()*3000;}
  if(S.interference>0&&now<tearUntil){
   g.fillStyle=`rgba(180,200,190,${.025+S.interference*.08})`;g.fillRect(0,tearY,W,2+S.interference*12);
   g.fillStyle='rgba(0,0,0,.12)';g.fillRect(0,tearY+13,W,2);
  }
  if(S.cameraOverlay){
   g.font='10px Consolas,"Microsoft YaHei",monospace';g.textBaseline='top';g.fillStyle='rgba(190,205,194,.65)';
   const label=demo?'CAM 01 / DEMO':'CAM 01 / LIVE';g.fillText(label,12,H-24);
   const stamp=new Date().toLocaleString('sv-SE',{hour12:false});g.textAlign='right';g.fillText(stamp,W-12,H-24);g.textAlign='left';
  }
 }
 return {draw};
}
