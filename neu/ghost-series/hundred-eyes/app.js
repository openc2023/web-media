import {loadSettings,saveSettings} from './settings.js?v=0.3.2';
import {createUI} from './ui.js?v=0.3.2';
import {loadEyes,imageFile} from './eye-assets.js?v=0.3.2';
import {EyeField} from './eye-field.js?v=0.3.2';
import {createMembrane,drawRoom} from './membrane.js?v=0.3.2';
import {Proximity} from './proximity.js?v=0.3.2';
import {Detector} from './detector.js?v=0.3.2';
const cfg=loadSettings(),$=id=>document.getElementById(id),video=$('video'),stage=$('stage'),source=$('cameraFrame');
const demo=location.hash==='#demo';let room=null,bgNow='',camDirty=false,agit=0,maskC=document.createElement('canvas');let field,water,detector,faces=[],lastFacesAt=0,epoch=0,started=false,starting=false,cameraStatus='',detectStatus='',lastFrame=-Infinity,lastDetect=-Infinity,lastVideo=-1,fps=0,frames=0,fpsAt=0;
const proximity=new Proximity();
// 演示模式：按住鼠标 / 手指 = 一个人站在那里（脸宽是靠近阈值的 85%，只闭他那一片）；按住 Shift = 走到最近（整面墙闭眼）
let mouseFace=null;
if(demo){const at=e=>{const r=stage.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
 stage.addEventListener('pointerdown',e=>{const p=at(e);mouseFace={...p,w:cfg.nearRatio*(e.shiftKey?1.2:.85),h:.2,screen:true};});
 stage.addEventListener('pointermove',e=>{if(mouseFace){const p=at(e);Object.assign(mouseFace,p);}});
 for(const ev of ['pointerup','pointercancel','pointerleave'])stage.addEventListener(ev,()=>{mouseFace=null;});}
const fullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}};
const onChange=key=>{if(['count','layoutSeed'].includes(key)&&field)field.rebuild(cfg);if(['rotation','deviceId'].includes(key)){faces=[];lastFacesAt=0;epoch++;}if(key==='nearRatio'||key==='farRatio')saveSettings(cfg);};
const ui=createUI(cfg,onChange,{camera:()=>startCamera(),refresh:()=>refreshCameras(),fullscreen});
function status(text,error=false){ui.status(text,error);detectStatus=error?text:detectStatus;}
async function refreshCameras(){
 try{const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');const s=$('deviceId');if(!s)return;s.replaceChildren(new Option(ui.tr(['默认摄像头','Default camera','기본 카메라']),''));devices.forEach((d,i)=>s.add(new Option(d.label||`CAM ${i+1}`,d.deviceId)));if(cfg.deviceId&&!devices.some(d=>d.deviceId===cfg.deviceId))s.add(new Option('Saved camera (unavailable)',cfg.deviceId));s.value=cfg.deviceId;}catch{}
}
function startDetector(){
 detector?.close();detectStatus=ui.tr(['识别加载中，实拍继续','Loading detection; camera stays live','인식 로딩 중, 영상 계속 표시']);
 try{detector=new Detector(cfg,data=>{if(data.epoch!==epoch)return;faces=data.faces;lastFacesAt=performance.now();},(message,error)=>{if(error){faces=[];detectStatus=message;status(message,true);}else{detectStatus='';}});}catch(e){status(e.message,true);}
}
async function startCamera(){
 if(starting)return;starting=true;$('start').disabled=true;
 try{
  if(demo){location.hash='';return;}
  if(!navigator.mediaDevices?.getUserMedia)throw new Error(ui.tr(['浏览器无法使用摄像头，请用 localhost 或 HTTPS','Camera needs localhost or HTTPS','카메라는 localhost 또는 HTTPS가 필요합니다']));
  video.srcObject?.getTracks().forEach(t=>t.stop());video.srcObject=null;faces=[];epoch++;
  const [w,h]=cfg.resolution==='1080'?[1920,1080]:cfg.resolution==='480'?[640,480]:[1280,720];
  const request={width:{ideal:w},height:{ideal:h}};if(cfg.deviceId)request.deviceId={exact:cfg.deviceId};else request.facingMode='user';
  status(ui.tr(['正在请求摄像头…','Requesting camera…','카메라 요청 중…']));
  const stream=await navigator.mediaDevices.getUserMedia({video:request,audio:false});video.srcObject=stream;await video.play();started=true;$('intro').hidden=true;ui.open(false);lastVideo=-1;
  const track=stream.getVideoTracks()[0],s=track.getSettings();cameraStatus=`${s.width}×${s.height} · ${track.label}`;if($('cameraInfo'))$('cameraInfo').textContent=cameraStatus;
  track.addEventListener('ended',()=>{started=false;faces=[];status(ui.tr(['摄像头已断开，请重新应用','Camera disconnected; apply camera again','카메라 연결이 끊겼습니다']),true);});refreshCameras();startDetector();
 }catch(e){started=false;video.srcObject?.getTracks().forEach(t=>t.stop());video.srcObject=null;$('intro').hidden=false;status(e.name==='NotAllowedError'?ui.tr(['摄像头权限被阻止，请允许后重试','Camera access blocked; allow it and retry','카메라 권한을 허용한 뒤 다시 시도하세요']):e.message,true);}
 finally{starting=false;$('start').disabled=false;}
}
$('start').onclick=startCamera;
function cameraFrame(){
 const vw=video.videoWidth,vh=video.videoHeight;if(!vw||!vh)return;
 const rotate=Number(cfg.rotation),swap=rotate%180!==0,w=swap?vh:vw,h=swap?vw:vh;
 if(source.width!==w||source.height!==h){source.width=w;source.height=h;stage.style.setProperty('--ar',String(w/h));}
 const g=source.getContext('2d');g.save();g.translate(w/2,h/2);g.rotate(rotate*Math.PI/180);g.drawImage(video,-vw/2,-vh/2,vw,vh);g.restore();camDirty=true;
}
function dimensions(){const r=stage.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);return {W:r.width,H:r.height,dpr};}
function draw(now){
 requestAnimationFrame(draw);if(!field||!water)return;
 if(now-lastFrame<1000/30)return;lastFrame=now;
 if(started&&video.readyState>=2&&video.currentTime!==lastVideo){lastVideo=video.currentTime;cameraFrame();if(now-lastDetect>=1000/cfg.detectHz){lastDetect=now;detector?.send(source,now,cfg,epoch);}}
 const {W,H,dpr}=dimensions();if(W<2||H<2)return;
 for(const id of ['eyes','water','hud']){const c=$(id),w=Math.round(W*dpr),h=Math.round(H*dpr);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}}
 const currentFaces=(now-lastFacesAt<Math.max(600,2500/cfg.detectHz)?faces:[]).concat(mouseFace?[mouseFace]:[]);
 const width=currentFaces.reduce((max,f)=>Math.max(max,f.w),0),closed=proximity.update(width,now,cfg);
 const t1=performance.now(),eg=$('eyes').getContext('2d');eg.setTransform(dpr,0,0,dpr,0,0);const zones=cfg.zoneOn?currentFaces.filter(f=>f.w>=cfg.zoneMin).map(f=>{const k=Math.max(0,Math.min(1,(f.w-cfg.zoneMin)/Math.max(.005,cfg.nearRatio-cfg.zoneMin)));return {x:(cfg.mirror&&!f.screen?1-f.x:f.x)*W,y:f.y*H,r:W*cfg.zoneSize*(.25+.75*k),k,w:f.w};}).sort((a,b)=>b.k-a.k):[];
 field.draw(eg,W,H,now,closed,cfg,zones);const t2=performance.now();
 // 肉膜 mask 只在布局变了时重画（低分辨率就够，着色器里会再加细纹）
 const mw=Math.max(2,Math.round(W/3)),mh=Math.max(2,Math.round(H/3));
 if(field.maskDirty||maskC.width!==mw||maskC.height!==mh){maskC.width=mw;maskC.height=mh;field.drawMask(maskC.getContext('2d'),mw,mh,cfg);water.setMask(maskC);}
 // 空洞后面：实拍空间，或者雾中窗格红梅
 const useCam=(cfg.bgMode==='camera'||(cfg.bgMode==='auto'&&started))&&started&&source.width>0;
 if(useCam&&(camDirty||bgNow!=='cam')){water.setBackground(source);camDirty=false;bgNow='cam';}else if(!useCam)bgNow='';
 agit+=((closed?1:0)-agit)*Math.min(1,(1/30)*2);
 water.draw(now,cfg,$('eyes'),useCam&&cfg.mirror,agit,useCam);window.__perf={eyes:t2-t1,gl:performance.now()-t2};
 const g=$('hud').getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
 if(cfg.vignette){const grad=g.createRadialGradient(W/2,H/2,Math.min(W,H)*.22,W/2,H/2,Math.hypot(W,H)*.55);grad.addColorStop(0,'transparent');grad.addColorStop(1,`rgba(0,0,0,${cfg.vignette*.7})`);g.fillStyle=grad;g.fillRect(0,0,W,H);}
 if(cfg.debug){g.strokeStyle='rgba(229,178,111,.8)';g.lineWidth=1;g.setLineDash([4,4]);for(const z of zones){g.beginPath();g.arc(z.x,z.y,z.r,0,6.3);g.stroke();g.fillStyle='#e5b26f';g.font='11px Consolas,monospace';g.fillText(`zone ${(z.w*100).toFixed(1)}%  k ${z.k.toFixed(2)}`,z.x-40,z.y-z.r-6);}g.setLineDash([]);g.strokeStyle='#7fd1a8';g.fillStyle='#7fd1a8';g.lineWidth=1;g.font='11px Consolas,monospace';for(const f of currentFaces)g.strokeRect((cfg.mirror?1-f.left-f.w:f.left)*W,f.top*H,f.w*W,f.h*H);g.fillText(`${demo?'DEMO':detector?.ready?'LIVE':'CAMERA'}  ${closed?'CLOSED':'AWAKE'}  faces ${currentFaces.length}  width ${(width*100).toFixed(1)}%  ${fps} FPS  eyes ${window.__perf.eyes.toFixed(1)}ms  gl ${window.__perf.gl.toFixed(1)}ms`,12,18);}
 if(demo){g.font='10px Consolas,monospace';g.fillStyle='rgba(160,195,200,.7)';g.fillText('DEMO / NO CAMERA · P = APPROACH',12,H-14);}
 frames++;if(now-fpsAt>1000){fps=Math.round(frames*1000/(now-fpsAt));frames=0;fpsAt=now;}
 ui.stats(`${demo?'DEMO · ':''}${cfg.testNear?'TEST · ':''}${closed?ui.tr(['闭眼','CLOSED','감기']):ui.tr(['苏醒','AWAKE','깨어남'])} · ${currentFaces.length}/${cfg.maxFaces} · ${fps} FPS`);
 if($('cameraInfo'))$('cameraInfo').textContent=detectStatus||cameraStatus;
}
async function init(){
 try{const sets=await loadEyes();field=new EyeField(sets);field.rebuild(cfg);water=createMembrane($('water'));room=drawRoom();water.setRoom(room);water.setWall(await imageFile('assets/water-wall.png'));status(ui.tr(['素材已就绪','Assets ready','소재 준비 완료']));if(demo){$('intro').hidden=true;started=false;}requestAnimationFrame(draw);refreshCameras();}
 catch(e){status(e.message,true);}
}
window.addEventListener('pagehide',()=>{detector?.close();video.srcObject?.getTracks().forEach(t=>t.stop());});
document.addEventListener('pointerdown',async()=>{try{await navigator.wakeLock?.request('screen');}catch{}},{once:true});
init();
