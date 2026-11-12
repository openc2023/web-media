import { t } from './ui.js?v=0.2.2';
export function createCamera(S,video,stage,save,resetTracks){
 const $=id=>document.getElementById(id);
 const frame=document.createElement('canvas');frame.id='cameraFrame';video.after(frame);video.style.display='none';
 const mirror=()=>stage.style.setProperty('--mirror',S.mirror?-1:1);
 function paint(){
  const vw=video.videoWidth,vh=video.videoHeight;if(!vw||!vh)return;
  const rotated=Number(S.rotation)%180!==0,fw=rotated?vh:vw,fh=rotated?vw:vh;
  if(frame.width!==fw||frame.height!==fh){frame.width=fw;frame.height=fh;stage.style.setProperty('--ar',String(fw/fh));}
  const c=frame.getContext('2d');c.save();c.clearRect(0,0,fw,fh);c.translate(fw/2,fh/2);c.rotate(Number(S.rotation)*Math.PI/180);c.drawImage(video,-vw/2,-vh/2,vw,vh);c.restore();
 }
 async function refresh(){
  try{
   if(!navigator.mediaDevices?.enumerateDevices)throw new Error(t('Camera list unavailable'));
   const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
   const select=$('deviceId');select.replaceChildren(new Option(t('Default camera'),''));
   devices.forEach((d,i)=>select.add(new Option(d.label||`${t('Camera')} ${i+1}`,d.deviceId)));
   if(S.deviceId&&!devices.some(d=>d.deviceId===S.deviceId))select.add(new Option(`${t('Camera')} · ${t('Unavailable')}`,S.deviceId));
   select.value=S.deviceId;
  }catch(e){$('cameraInfo').textContent=e.message;}
 }
 async function open(){
  const size={'480':[640,480],'720':[1280,720],'1080':[1920,1080],'2160':[3840,2160]}[S.resolution]||[1280,720];
  video.srcObject?.getTracks().forEach(track=>track.stop());video.srcObject=null;
  const context=frame.getContext('2d');context.clearRect(0,0,frame.width,frame.height);
  const constraints={width:{ideal:size[0]},height:{ideal:size[1]}};
  if(S.deviceId)constraints.deviceId={exact:S.deviceId};else constraints.facingMode='user';
  const stream=await navigator.mediaDevices.getUserMedia({video:constraints,audio:false});video.srcObject=stream;await video.play();paint();$('intro').hidden=true;await refresh();
  const actual=stream.getVideoTracks()[0]?.getSettings();
  $('cameraInfo').textContent=`${stream.getVideoTracks()[0]?.label||t('Camera')} · ${actual?.width||video.videoWidth} × ${actual?.height||video.videoHeight} · ${actual?.frameRate?.toFixed(0)||'—'} FPS`;
 }
 for(const key of ['deviceId','resolution','rotation']){
  $(key).value=String(S[key]);$(key).onchange=()=>{S[key]=key==='rotation'?Number($(key).value):$(key).value;save();if(key==='rotation'){resetTracks();paint();}};
 }
 $('mirror').checked=S.mirror;$('mirror').onchange=()=>{S.mirror=$('mirror').checked;save();mirror();};
 $('refreshCameras').onclick=refresh;mirror();refresh();return {frame,paint,open};
}
