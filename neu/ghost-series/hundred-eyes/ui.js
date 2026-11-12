import {saveSettings} from './settings.js?v=0.3';
const L=(zh,en,ko)=>[zh,en,ko];
export function createUI(cfg,onChange,actions){
 const $=id=>document.getElementById(id),side=$('side');let opened=false,page=0,lastFocus;
 const tr=v=>Array.isArray(v)?v[{zh:0,en:1,ko:2}[cfg.lang]??0]:v;
 const groups=[
  {name:L('镜头','Camera','카메라'),items:[
   ['select','deviceId',L('摄像头','Camera source','카메라 장치'),[['',L('默认摄像头','Default camera','기본 카메라')]]],
   ['select','resolution',L('分辨率','Resolution','해상도'),[['480','640 × 480'],['720','1280 × 720'],['1080','1920 × 1080']]],
   ['select','rotation',L('旋转','Rotation','회전'),[[0,'0°'],[90,'90°'],[180,'180°'],[270,'270°']]],
   ['check','mirror',L('镜像','Mirror','좌우 반전')]]},
  {name:L('识别','Detection','인식'),items:[
   ['range','nearRatio',L('靠近脸宽比','Near face width','접근 얼굴 너비'),.03,.4,.005],['range','farRatio',L('远离脸宽比','Far face width','멀어짐 얼굴 너비'),.02,.35,.005],
   ['range','enterHold',L('确认靠近 / 秒','Near hold / s','접근 확인 / 초'),0,2,.05],['range','leaveHold',L('远离延迟 / 秒','Release delay / s','멀어짐 지연 / 초'),.1,5,.1],
   ['range','maxFaces',L('最多人数','Max people','최대 인원'),1,6,1],['range','faceConfidence',L('人脸置信度','Face confidence','얼굴 신뢰도'),.2,.9,.05],
   ['range','detectHz',L('检测频率','Detection rate','검출 빈도'),2,15,1],['check','debug',L('识别框与状态','Detection overlay','검출 정보')],['check','testNear',L('测试：模拟靠近（P）','Test: simulate near (P)','테스트: 접근 (P)')]]},
  {name:L('眼睛','Eyes','눈'),items:[
   ['number','layoutSeed',L('随机种子','Random seed','랜덤 시드'),1,2147483647,1],['range','eyeSpacing',L('眼间留白','Eye spacing','눈 간격'),0,.8,.02],
   ['range','count',L('眼睛数量','Eye count','눈 개수'),10,160,1],['range','eyeScale',L('整体大小','Overall size','전체 크기'),.5,2.5,.05],
   ['range','sizeVariation',L('大小差异','Size variation','크기 차이'),0,1,.05],['range','overlap',L('挤压重叠','Crowding overlap','겹침'),0,.4,.01],
   ['range','gap',L('中间空洞','Opening in the middle','가운데 틈'),0,1.2,.05],['range','eyeMix',L('浑浊眼比例','Clouded eye share','흐린 눈 비율'),0,1,.05],
   ['range','rotationSpread',L('倾斜差异 / 度','Tilt variation / °','기울기 / °'),0,50,1],
   ['range','eyeOpacity',L('眼睛不透明度','Eye opacity','눈 불투명도'),.1,1,.01],['range','eyeExposure',L('眼睛亮度','Eye exposure','눈 밝기'),.2,1.4,.01],['range','eyeSaturation',L('眼睛饱和度','Eye saturation','눈 채도'),0,1.4,.05],
   ['range','closeDuration',L('闭眼用时 / 秒','Close time / s','감기 시간 / 초'),.1,2,.01],['range','openDuration',L('睁眼用时 / 秒','Open time / s','뜨기 시간 / 초'),.2,3,.1],
   ['range','openDelay',L('随机苏醒间隔 / 秒','Wake spread / s','깨어남 간격 / 초'),.5,12,.5],['range','blinkInterval',L('随机睁眼停留 / 秒','Open hold / s','뜨기 유지 / 초'),1,12,.5]]},
  {name:L('画面','Display','화면'),items:[
   ['select','bgMode',L('空洞后面','Behind the opening','틈 뒤의 배경'),[['auto',L('自动（实拍 / 无摄像头时窗格）','Auto (camera, lattice without camera)','자동 (카메라 / 없으면 창살)')],['camera',L('实拍空间','Camera space','카메라 공간')],['room',L('雾中窗格红梅','Misty lattice & plum','안개 속 창살과 매화')]]],
   ['range','roomOpacity',L('窗花不透明度（叠在实拍上）','Lattice opacity (over camera)','창살 불투명도 (카메라 위)'),0,1,.05],['range','waterOpacity',L('前景水墙不透明度','Front water wall opacity','앞 물벽 불투명도'),0,1,.02],['range','waterSpeed',L('水墙流速','Water wall flow','물벽 흐름'),0,3,.05],
   ['range','fleshCover',L('肉膜覆盖','Membrane cover','막 덮임'),0,1,.02],['range','fleshTone',L('肉膜亮度','Membrane brightness','막 밝기'),.4,1.8,.05],
   ['range','gloss',L('湿润高光','Wet highlights','젖은 광택'),0,2.5,.05],['range','drip',L('水痕多少','Drips','물줄기'),0,2.5,.05],['range','dripSpeed',L('水痕速度','Drip speed','물줄기 속도'),0,3,.05],
   ['range','refraction',L('水痕折射','Drip refraction','물줄기 굴절'),0,3,.05],['range','fog',L('背景雾','Background fog','배경 안개'),0,1,.02],
   ['range','cameraSaturation',L('实拍饱和度','Camera saturation','영상 채도'),0,1,.05],['range','cameraExposure',L('实拍亮度','Camera exposure','영상 밝기'),.4,1.5,.05],['range','vignette',L('暗角','Vignette','비네팅'),0,1,.05]]}
 ];
 function change(key,value){cfg[key]=value;if(key==='nearRatio')cfg.farRatio=Math.min(cfg.farRatio,value-.005);if(key==='farRatio')cfg.farRatio=Math.min(value,cfg.nearRatio-.005);if(['nearRatio','farRatio'].includes(key)){const e=$('farRatio');if(e){e.value=cfg.farRatio;if(e.nextElementSibling)e.nextElementSibling.value=cfg.farRatio;}}saveSettings(cfg);onChange(key);}
 function build(){
  document.documentElement.lang=cfg.lang==='zh'?'zh-CN':cfg.lang;
  $('tabs').replaceChildren();$('panes').replaceChildren();
  groups.forEach((group,i)=>{
   const b=document.createElement('button');b.textContent=tr(group.name);b.setAttribute('role','tab');b.onclick=()=>select(i);$('tabs').append(b);
   const pane=document.createElement('section');pane.className='pane';pane.setAttribute('role','tabpanel');const panel=document.createElement('div');panel.className='panel';const h=document.createElement('h3');h.textContent=tr(group.name);panel.append(h);pane.append(panel);$('panes').append(pane);
   for(const [type,key,label,a,z,step]of group.items){
    const row=document.createElement(type==='check'?'label':'div');row.className=type==='check'?'ck':'row';
    const input=document.createElement(type==='select'?'select':'input');input.id=key;
    if(type!=='select')input.type=type==='check'?'checkbox':type==='number'?'number':'range';
    if(type==='check'){input.checked=cfg[key];row.append(input,document.createTextNode(tr(label)));input.onchange=()=>change(key,input.checked);}
    else{const lab=document.createElement('label');lab.htmlFor=key;lab.textContent=tr(label);row.append(lab,input);}
    if(type==='select'){for(const [value,text]of a)input.add(new Option(tr(text),value));input.value=String(cfg[key]);input.onchange=()=>change(key,key==='rotation'?Number(input.value):input.value);}
    if(type==='range'){
     Object.assign(input,{min:a,max:z,step,value:cfg[key]});const num=document.createElement('input');Object.assign(num,{type:'number',min:a,max:z,step,value:cfg[key]});num.className='nv';num.setAttribute('aria-label',tr(label));row.append(num);
     input.oninput=()=>{num.value=input.value;change(key,Number(input.value));};num.onchange=()=>{if(!num.validity.valid||num.value===''){num.value=cfg[key];return;}input.value=num.value;change(key,Number(input.value));};
    }panel.append(row);
    if(type==='number'){Object.assign(input,{min:a,max:z,step,value:cfg[key]});input.className='nv seed';input.onchange=()=>{if(input.validity.valid&&input.value!=='')change(key,Number(input.value));else input.value=cfg[key];};}
   }
   if(i===2){const randomize=document.createElement('button');randomize.className='btn';randomize.textContent=tr(L('重新随机布局','Randomize layout','배치 다시 섞기'));randomize.onclick=()=>{const seed=1+Math.floor(Math.random()*2147483646);$('layoutSeed').value=seed;change('layoutSeed',seed);};panel.prepend(randomize);}
   if(i===0){const btns=document.createElement('div');btns.className='grid2';for(const [name,fn]of [[L('应用摄像头','Apply camera','카메라 적용'),actions.camera],[L('刷新列表','Refresh cameras','목록 새로고침'),actions.refresh],[L('全屏','Fullscreen','전체 화면'),actions.fullscreen],[L('关闭设置','Close settings','설정 닫기'),()=>open(false)]]){const b=document.createElement('button');b.className='btn';b.textContent=tr(name);b.onclick=fn;btns.append(b);}const link=document.createElement('a');link.className='btn';link.href=location.hash==='#demo'?location.pathname+location.search:'#demo';link.textContent=tr(location.hash==='#demo'?L('返回实拍','Live camera','카메라 모드'):L('无摄像头预览','Camera-free preview','카메라 없이 미리보기'));btns.append(link);panel.append(btns);const info=document.createElement('p');info.id='cameraInfo';info.className='info';panel.append(info);}
   const note=document.createElement('p');note.className='small';note.textContent=tr(i===1?L('任意一人靠近，整面眼睛闭合。脸宽比例用于估计靠近，不是米制距离。','Any nearby face closes the wall. Face width is a proximity estimate, not meters.','한 명이라도 접근하면 모두 감습니다. 얼굴 너비를 이용한 접근 추정입니다.'):i===2?L('湿润眼睛 + 第三只眼，随机混合。原始 GIF 帧独立控制，不同步循环。','Wet eye + third eye, mixed randomly. GIF frames are controlled independently.','두 눈 소재를 무작위로 섞어 각각 재생합니다.'):i===3?L('层次：空洞后面的空间（实拍 + 半透明窗花）→ 湿亮的肉膜 → 眼睛 → 往下流的水痕 → 最前面一层半透明水墙。有人靠近时水流得更急。','Layers: space behind the opening (camera or lattice) → wet membrane → eyes → running drips. Drips run faster while someone is close.','층: 틈 뒤 공간 (카메라 또는 창살) → 젖은 막 → 눈 → 흐르는 물줄기. 사람이 가까우면 더 빨리 흐릅니다.'):L('S 设置 · F 全屏 · P 测试靠近；手机右上连点三下。','S settings · F fullscreen · P simulate near; triple-tap top right on mobile.','S 설정 · F 전체 화면 · P 접근 테스트; 오른쪽 위 세 번 탭.'));pane.append(note);
  });
  $('start').textContent=tr(L('启动摄像头','Start camera','카메라 시작'));$('demoLink').textContent=tr(L('无摄像头预览','Camera-free preview','카메라 없이 미리보기'));document.querySelector('#intro h2').textContent=tr(L('百眼墙','Hundred Eyes','백안의 벽'));
  $('introText').textContent=tr(L('靠近，百眼闭合。远离，水幕后面的眼睛重新苏醒。','Come close: the eyes close. Step away: they awaken behind the water.','다가가면 눈을 감고, 멀어지면 물막 뒤에서 다시 깨어납니다.'));
  document.querySelectorAll('[data-lang]').forEach(b=>b.classList.toggle('on',b.dataset.lang===cfg.lang));select(page);
 }
 function select(index){page=index;[...$('tabs').children].forEach((b,i)=>{b.classList.toggle('on',i===index);b.setAttribute('aria-selected',String(i===index));});[...$('panes').children].forEach((p,i)=>p.classList.toggle('on',i===index));}
 function open(value){opened=value;if(value)lastFocus=document.activeElement;side.inert=!value;side.classList.toggle('open',value);document.body.classList.toggle('settings-open',value);if(value)$('close').focus();else lastFocus?.focus();}
 $('close').onclick=()=>open(false);let taps=[];$('hotspot').onclick=e=>{if(e.detail===0)return open(!opened);const now=Date.now();taps=taps.filter(t=>now-t<900);taps.push(now);if(taps.length===3){open(!opened);taps=[];}};
 document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{cfg.lang=b.dataset.lang;saveSettings(cfg);build();actions.refresh();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')open(false);if(/input|select|textarea/i.test(e.target.tagName)||e.ctrlKey||e.altKey||e.metaKey)return;const k=e.key.toLowerCase();if(k==='s')open(!opened);if(k==='f')actions.fullscreen();if(k==='p'){change('testNear',!cfg.testNear);const t=$('testNear');if(t)t.checked=cfg.testNear;}});
 let touchTimer;document.addEventListener('touchstart',e=>{clearTimeout(touchTimer);if(e.touches.length===2&&!side.contains(e.target))touchTimer=setTimeout(()=>open(!opened),1200);},{passive:true});for(const ev of ['touchend','touchcancel','touchmove'])document.addEventListener(ev,()=>clearTimeout(touchTimer),{passive:true});
 document.addEventListener('contextmenu',e=>{if(!side.contains(e.target))e.preventDefault();});window.addEventListener('hashchange',()=>location.reload());
 build();return {tr,open,status(text,error=false){$('introStatus').textContent=text;$('introStatus').classList.toggle('err',error);},stats(text){$('liveStats').textContent=text;}};
}
