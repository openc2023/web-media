const fitScale=new Set(['fs','fw','fh','fd']),fitPosition=new Set(['fx','fy','fz']);
const isFit=id=>fitScale.has(id)||fitPosition.has(id);
export function ensureFitRange(id,value){
 if(!isFit(id)||!Number.isFinite(Number(value)))return;
 const range=document.getElementById(id);if(!range)return;
 if(Number(value)<Number(range.min))range.min=String(value);
 if(Number(value)>Number(range.max))range.max=String(value);
}
const dict = {
 'The fingertip lens disappears when no hand is confirmed.':['没有确认到手部时，指尖透视镜和圆圈自动隐藏。','손이 확인되지 않으면 손끝 렌즈와 원이 숨겨집니다.'],
 'Hand validation':['手部防误识别','손 오검출 방지'], 'Hand confidence':['手部置信度','손 검출 신뢰도'], 'Confirm frames':['连续确认帧数','연속 확인 프레임'], 'Min hand size':['最小手部尺寸','최소 손 크기'], 'Simulated hand (demo only)':['模拟手骨（仅演示）','가상 손뼈 (데모 전용)'], 'Calibration values can extend beyond the slider range.':['数值框可超出滑块范围，滑块会自动扩展；缩放必须大于零。','숫자를 입력하면 슬라이더 범위가 자동 확장됩니다. 크기는 0보다 커야 합니다.'],
 'Tip: pick the Solid look and set "Real me showing through" to about half, then line the skull up with your face.':['提示：选择“实体”，把“真人透出”调到一半左右，再将头骨对齐面部。','팁: 불투명 모드에서 실제 영상 투명도를 절반 정도로 설정한 뒤 두개골을 얼굴에 맞추세요.'],
 'Case archive':['返回案卷','사건 목록'], 'X-RAY MIRROR':['X 光镜','X선 거울'],
 'Camera look':['摄像机风格','카메라 스타일'], 'Grey surveillance':['灰调监控','흑백 감시'], 'Vintage color':['老式彩色','빈티지 컬러'], 'Clean camera':['原始画面','원본 영상'], 'Custom':['自定义','사용자 지정'], 'Warm cast':['暖色偏移','따뜻한 색감'], 'Lens softness':['镜头柔化','렌즈 부드럽게'],
 'Surveillance look':['监控质感','감시 카메라 효과'], 'Saturation':['饱和度','채도'], 'Camera exposure':['镜头曝光','카메라 노출'], 'Camera contrast':['镜头对比度','카메라 대비'], 'Film grain':['噪点','영상 노이즈'], 'Scanlines':['扫描线','스캔라인'], 'Vignette':['暗角','비네팅'], 'Signal interference':['信号干扰','신호 간섭'], 'Camera overlay':['监控信息叠加','카메라 정보 표시'],
 'Live camera':['实拍模式','실시간 카메라'],
 'Anomaly':['异常','이상 현상'], 'Anomaly sequence':['异常剧情','이상 현상 연출'], 'Run the anomaly':['开启异常剧情','이상 현상 켜기'], 'Calm (s)':['平静（秒）','평온 (초)'], 'Vitals go wrong (s)':['体征异常（秒）','생체 이상 (초)'], 'Manifestation (s)':['显形（秒）','현현 (초)'], 'Signal lost (s)':['断讯（秒）','신호 끊김 (초)'], 'Random variation':['每轮随机差异','회차별 랜덤 차이'], 'Restart sequence':['重新开始剧情','처음부터 다시'],
 'Each person runs on their own: calm → vitals go wrong → no vital signs, black eye sockets, skull cracks, a hand that belongs to no one → signal lost → again.':['每个人各走各的：平静 → 体征越来越不对 → 无生命体征、眼眶变黑洞、头骨裂开、肩后多出一只不属于任何人的手骨 → 断讯 → 再来一轮。人离开就重来。','사람마다 따로 진행됩니다: 평온 → 생체 신호 이상 → 생체 신호 없음, 검은 눈구멍, 두개골 균열, 누구의 것도 아닌 손 → 신호 끊김 → 반복. 사람이 떠나면 처음부터.'],
 'Manifestations':['显形内容','현현 요소'], 'Black eye sockets':['黑眼洞 + 黑泪','검은 눈구멍 + 검은 눈물'], 'Skull cracks':['头骨裂痕','두개골 균열'], 'Extra hand bones':['肩后多出的手骨','어깨 뒤의 손뼈'], 'Bone color':['骨骼配色','뼈 색상'], 'Old film bone':['旧胶片骨白','오래된 필름 뼈색'], 'Medical blue':['医疗蓝（原版）','의료용 파랑 (원본)'], 'Sound volume':['音量','볼륨'],
 'Sound: heartbeat that slows and stumbles, a flat tone, static. It starts after the first click or key press.':['声音：越来越慢、乱跳的心跳 → 平直长鸣 → 静电。浏览器要求先点一下或按一下键才会出声。','소리: 점점 느려지고 불규칙한 심장 소리 → 평탄음 → 잡음. 첫 클릭이나 키 입력 후 재생됩니다.'],
 'NO VITAL SIGNS':['无生命体征','생체 신호 없음'],
 'Near threshold (face width)':['近距离阈值（脸宽）','근접 기준 (얼굴 너비)'], 'Max people manifesting at once':['同时显形最多人数','동시에 현현할 최대 인원'], 'Random start delay (s)':['开始前随机等待（秒）','시작 전 랜덤 대기 (초)'], 'Reset after leaving (s)':['退远多久后重来（秒）','멀어진 뒤 초기화 (초)'],
 'Only people closer than the near threshold run the sequence; others show plain bones. Stepping back pauses it, staying away resets it. When the manifestation slots are full, the rest wait at the end of “vitals go wrong”, nearest first.':['只有比近距离阈值更近的人才走剧情，远处的人只显示普通骨头。退远就暂停，一直不回来就重来。显形名额满了，其他人停在“体征异常”末尾排队，离得近的先。','근접 기준보다 가까운 사람만 연출이 진행되고, 먼 사람은 평범한 뼈만 보입니다. 멀어지면 멈추고, 계속 멀리 있으면 처음부터. 현현 인원이 차면 나머지는 ‘생체 이상’ 끝에서 대기하며 가까운 사람이 먼저입니다.'],
 'Detection':['识别','인식'], 'People':['多人追踪','다중 추적'], 'Max people':['最大人数','최대 인원'], 'Min face size':['最小脸宽','최소 얼굴 너비'], 'Confidence':['识别置信度','검출 신뢰도'], 'Stabilize':['跟随平滑','추적 안정화'], 'Lost tolerance (s)':['丢失容忍（秒）','놓침 허용 (초)'], 'Detection rate':['检测频率','검출 빈도'], 'Priority':['挑人优先级','추적 우선순위'], 'Nearest first':['最近优先','가까운 사람 우선'], 'Center first':['中心优先','중앙 우선'], 'Detection overlay':['识别调试叠加','검출 디버그 표시'],
 'Saved for camera mode.':['已保存，切换到摄像头模式后使用。','저장됨. 카메라 모드에서 적용됩니다.'], 'Unavailable':['不可用','사용 불가'], 'Camera list unavailable':['浏览器无法列出摄像头','카메라 목록을 불러올 수 없습니다'],
 'Camera source':['摄像头','카메라 장치'], 'Default camera':['默认摄像头','기본 카메라'], 'Resolution':['分辨率','해상도'], 'Rotation':['旋转','회전'], 'Mirror':['镜像','좌우 반전'], 'Refresh cameras':['刷新摄像头列表','카메라 목록 새로고침'], 'Apply camera':['应用摄像头设置','카메라 설정 적용'], 'Camera changes apply with this button.':['更换镜头、分辨率后点应用；首次使用请先启动摄像头。','장치나 해상도 변경 후 적용하세요. 처음에는 카메라를 시작하세요.'],
 'Vitals overlay':['生命体征叠加','생체 신호 오버레이'], 'Simulated vitals':['模拟生命体征','가상 생체 신호'], 'Overlay opacity':['叠加不透明度','오버레이 불투명도'], 'SIMULATED DATA':['模拟数据','가상 데이터'], 'Faces':['人数','인원'], 'Per-person random animation, not camera measurements.':['每人独立随机变化，仅为视觉效果，并非摄像头测量。','사람마다 무작위로 변하는 시각 효과이며 카메라 측정값이 아닙니다.'], 'Hand tracking: 2 hands total.':['手部追踪：整幅画面最多 2 只手。','손 추적: 화면 전체에서 최대 2개.'], 'Nearby faces keep their slots briefly when occluded.':['短暂遮挡时保留位置；交叉走动仍可能交换编号。','잠시 가려져도 유지합니다. 서로 교차하면 번호가 바뀔 수 있습니다.'],
 'Layers':['图层','레이어'], 'Look':['外观','표현'], 'Mixed reality':['混合现实','혼합 현실'], 'Fit to my head':['头部校准','머리 보정'],
 'Skull':['头骨','두개골'], 'Brain':['脑部','뇌'], 'Muscles':['肌肉','근육'], 'Everything':['全部','전체'], 'Eyes':['眼球','눈'], 'Head outline':['头部轮廓','머리 윤곽'], 'Hand bones':['手骨','손뼈'],
 'Show labels':['显示解剖标注','해부학 명칭 표시'], 'X-ray':['X 光','X선'], 'Solid':['实体','불투명'], 'Brightness':['亮度','밝기'],
 'Real me showing through':['真人透出','실제 영상 투명도'], 'Edge feather':['边缘羽化','가장자리 부드럽게'], 'Reveal':['显示区域','표시 영역'],
 'Whole head':['整个头部','머리 전체'], 'Left half only':['左半边','왼쪽 절반'], 'Right half only':['右半边','오른쪽 절반'], 'Top of the head only':['头顶','머리 위쪽'], 'Lower face only':['下半脸','얼굴 아래쪽'], 'X-ray lens (follows your fingertip)':['指尖跟随透视镜','손끝 추적 X선 렌즈'],
 'Cut position':['切割位置','절단 위치'], 'Lens size':['透视镜大小','렌즈 크기'], 'Show tracking data':['显示追踪数据','추적 데이터 표시'],
 'Overall size':['整体大小','전체 크기'], 'Width':['宽度','너비'], 'Height':['高度','높이'], 'Depth':['深度','깊이'], 'Left / right':['左右偏移','좌우 이동'], 'Up / down':['上下偏移','상하 이동'], 'Forward / back':['前后偏移','앞뒤 이동'], 'Reset fit':['重置校准','보정 초기화'],
 'Start camera':['启动摄像头','카메라 시작'], 'Demo without camera':['无摄像头演示','카메라 없이 데모'],
 'See the skull, brain and muscles inside your own head, tracked live through your camera. Hold a hand up to see its bones.':['头骨、脑部与肌肉随头部实时移动，抬手即可显示手骨。','카메라로 머리의 움직임을 추적합니다. 손을 들면 손뼈도 표시됩니다.'],
 'Camera':['镜头','카메라'], 'Anatomy':['解剖','해부'], 'Display':['画面','화면'], 'Calibration':['校准','보정'], 'Settings':['设置','설정'], 'Fullscreen':['全屏 / 退出全屏','전체 화면 전환'], 'Close settings':['关闭设置','설정 닫기'],
 'S · settings / F · fullscreen / P · demo':['S 设置 · F 全屏 · P 演示；手机右上角连点三下','S 설정 · F 전체 화면 · P 데모; 오른쪽 위 세 번 탭'],
 'The anatomy is a real 3D dataset of one adult, scaled and pinned to your head. It shows where structures typically sit, not a scan of you, and it is not a medical tool. Video is processed on this computer and never uploaded.':['解剖模型来自一位成人的数据，按头部姿态对齐，不是你的扫描结果，也不是医疗工具。视频仅在本机处理，不上传。','성인 한 명의 해부 모델을 머리에 맞춰 표시합니다. 본인의 스캔이나 의료 도구가 아닙니다. 영상은 기기에서만 처리하며 업로드하지 않습니다.'],
 'Click Start camera, then allow the camera.':['点击“启动摄像头”，然后允许摄像头权限。','카메라 시작을 누른 후 카메라 사용을 허용하세요.'],
 'Demo scene (no camera).':['演示模式 · 无摄像头','데모 모드 · 카메라 없음'], 'Asking for the camera…':['正在请求摄像头…','카메라 요청 중…'], 'Loading the 3D anatomy…':['正在载入 3D 解剖模型…','3D 해부 모델 로딩 중…'],
 'Loading the face and hand trackers (first time takes a few seconds)…':['正在载入人脸与手部追踪…','얼굴 및 손 추적 모델 로딩 중…'],
 'Tracking your head.':['正在追踪头部。','머리 추적 중.'], ' Hand bones on.':[' 手骨已显示。',' 손뼈 표시 중.'],
 'Hand found. Face the camera to see inside your head.':['已检测到手，请正对摄像头以显示头部。','손 감지됨. 카메라를 정면으로 보세요.'],
 'No face found. Face the camera, with light on your face.':['未检测到人脸，请面向摄像头并保持面部明亮。','얼굴 없음. 밝은 곳에서 카메라를 정면으로 보세요.'],
 'Camera blocked. Allow camera access for this page and click Start again.':['摄像头权限被阻止。请允许此页面使用摄像头后重试。','카메라 권한이 차단되었습니다. 허용 후 다시 시작하세요.']
};
let lang = 'zh';
try { lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem('ghostSeriesLang') || localStorage.getItem('ghostXrayLang') || 'zh'; } catch {}
if (!['zh','en','ko'].includes(lang)) lang = 'zh';
export const t = text => lang === 'en' ? text : dict[text]?.[lang === 'ko' ? 1 : 0] || text;
export function translateStatus(text) {
 if (dict[text]) return t(text);
 if (text === 'Tracking your head. Hand bones on.') return t('Tracking your head.') + t(' Hand bones on.');
 const prefixes = [['Could not load the ', '无法载入 ', '로드 실패: '], ['Demo failed: ', '演示加载失败：', '데모 로드 실패: '], ['The tracker hit an error: ', '追踪出错：', '추적 오류: ']];
 for (const [en,zh,ko] of prefixes) if (text.startsWith(en)) return (lang === 'zh' ? zh : lang === 'ko' ? ko : en) + text.slice(en.length);
 return text;
}
const side = document.getElementById('side');
document.body.append(side);
const panels = [...side.querySelectorAll('.panel')];
side.querySelector('h1').remove();
const notes = [...side.querySelectorAll(':scope > .small')];
side.insertAdjacentHTML('afterbegin', `<header class="top"><div class="brand">GHOST / X-RAY<em>v0.3.1</em></div><div class="sp"></div><div class="seg" id="lang"><button data-lang="zh">中</button><button data-lang="en">EN</button><button data-lang="ko">한</button></div><button class="btn icon ghost" id="close" aria-label="Close settings">✕</button></header><nav class="tabs" id="tabs" aria-label="Settings"></nav><div id="panes"></div><footer id="statusbar"><span class="dot"></span><span id="liveStats">LOCAL · X-RAY</span><span class="v">v0.3.1</span></footer>`);
const panes = document.getElementById('panes'), tabs = document.getElementById('tabs');
const groups = [['Camera',[0]],['Detection',[]],['Anatomy',[1]],['Display',[2,3,4]],['Calibration',[5]]];
groups.forEach(([name,indices],i) => {
 const button = document.createElement('button'); button.textContent=name; button.setAttribute('role','tab'); button.onclick=()=>selectTab(i); tabs.append(button);
 const pane = document.createElement('section'); pane.className='pane'; pane.setAttribute('role','tabpanel'); indices.forEach(n=>pane.append(panels[n])); panes.append(pane);
});
function selectTab(i) { [...tabs.children].forEach((b,n)=>{b.classList.toggle('on',n===i);b.setAttribute('aria-selected',String(n===i));}); [...panes.children].forEach((p,n)=>p.classList.toggle('on',n===i)); }
panes.children[0].insertAdjacentHTML('beforeend','<div class="group"><div class="ghead">Settings</div><div class="grid2"><button class="btn" id="full">Fullscreen</button><a class="btn" href="#demo">Demo without camera</a><button class="btn" id="closeBottom">Close settings</button></div><p class="info">S · settings / F · fullscreen / P · demo</p></div>');
notes.forEach(n=>panes.children[0].append(n));
if(location.pathname.includes('/ghost-xray/'))panes.children[0].querySelector('.grid2').insertAdjacentHTML('beforeend','<a class="btn" href="../">Case archive</a>');
const slider=(id,label,min,max,step)=>`<div class="row"><label for="${id}">${label}</label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}"></div>`;
const check=(id,label)=>`<label class="ck"><input id="${id}" type="checkbox">${label}</label>`;
panes.children[0].insertAdjacentHTML('afterbegin',`<div class="panel"><h3>Camera</h3>
 <div class="row"><label for="deviceId">Camera source</label><select id="deviceId"><option value="">Default camera</option></select></div>
 <div class="row"><label for="resolution">Resolution</label><select id="resolution"><option value="480">640 × 480</option><option value="720">1280 × 720</option><option value="1080">1920 × 1080</option><option value="2160">3840 × 2160</option></select></div>
 <div class="row"><label for="rotation">Rotation</label><select id="rotation"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></div>
 ${check('mirror','Mirror')}<div class="grid2"><button class="btn" id="refreshCameras">Refresh cameras</button><button class="btn primary" id="applyCamera">Apply camera</button></div><p class="info">Camera changes apply with this button.</p><p class="info" id="cameraInfo" role="status"></p></div>`);
panes.children[1].innerHTML=`<div class="panel"><h3>People</h3>${slider('maxFaces','Max people',1,6,1)}${slider('minFace','Min face size',.01,.3,.005)}${slider('confidence','Confidence',.1,.95,.05)}${slider('smooth','Stabilize',.1,1,.05)}${slider('lostGrace','Lost tolerance (s)',.1,3,.1)}${slider('detectHz','Detection rate',5,30,1)}<div class="row"><label for="priority">Priority</label><select id="priority"><option value="near">Nearest first</option><option value="center">Center first</option></select></div>${check('debug','Detection overlay')}<p class="info">Nearby faces keep their slots briefly when occluded.</p><p class="info">Hand tracking: 2 hands total.</p></div>`;
panes.children[1].insertAdjacentHTML('beforeend',`<div class="panel"><h3>Hand validation</h3>${slider('handConfidence','Hand confidence',.4,.95,.05)}${slider('handFrames','Confirm frames',2,6,1)}${slider('minHandSize','Min hand size',.02,.25,.01)}<div ${location.hash==='#demo'?'':'hidden'}>${check('demoHands','Simulated hand (demo only)')}</div></div>`);
panes.children[4].insertAdjacentHTML('beforeend','<p class="small">Calibration values can extend beyond the slider range.</p>');
for(const id of [...fitScale,...fitPosition]){const range=document.getElementById(id);range.min=fitScale.has(id)?'.25':'-20';range.max=fitScale.has(id)?'3':'20';}
if(location.hash==='#demo')panes.children[0].querySelector('.grid2').insertAdjacentHTML('afterbegin',`<a class="btn primary" href="${location.pathname+location.search}">Live camera</a>`);
panes.children[3].insertAdjacentHTML('beforeend',`<div class="panel"><h3>Vitals overlay</h3>${check('vitals','Simulated vitals')}${slider('vitalsOpacity','Overlay opacity',.1,1,.05)}<p class="info">Per-person random animation, not camera measurements.</p></div>`);
document.getElementById('reveal').closest('.panel').insertAdjacentHTML('beforeend','<p class="info">The fingertip lens disappears when no hand is confirmed.</p>');
panes.children[3].insertAdjacentHTML('afterbegin',`<div class="panel"><h3>Surveillance look</h3><div class="row"><label for="cameraLook">Camera look</label><select id="cameraLook"><option value="gray">Grey surveillance</option><option value="vintage">Vintage color</option><option value="clean">Clean camera</option><option value="custom">Custom</option></select></div>${slider('cameraSaturation','Saturation',0,1,.05)}${slider('cameraExposure','Camera exposure',.4,1.5,.05)}${slider('cameraContrast','Camera contrast',.5,2,.05)}${slider('warmth','Warm cast',0,1,.05)}${slider('softness','Lens softness',0,1,.05)}${slider('grain','Film grain',0,1,.05)}${slider('scanlines','Scanlines',0,1,.05)}${slider('vignette','Vignette',0,1,.05)}${slider('interference','Signal interference',0,1,.05)}${check('cameraOverlay','Camera overlay')}</div>`);
document.body.insertAdjacentHTML('beforeend','<button id="hotspot" aria-label="Settings" title="S · Settings"></button>');
let opened=false, lastFocus=null;
function open(value) { opened=value; if(value) lastFocus=document.activeElement; side.inert=!value; side.classList.toggle('open',value); document.body.classList.toggle('settings-open',value); document.body.classList.toggle('hide-cursor',!value && document.getElementById('intro').hidden); if(value) document.getElementById('close').focus(); else lastFocus?.focus(); }
document.getElementById('close').onclick=()=>open(false); document.getElementById('closeBottom').onclick=()=>open(false);
let taps=[]; document.getElementById('hotspot').onclick=e=>{ if(e.detail===0) return open(!opened); const now=Date.now();taps=taps.filter(x=>now-x<900);taps.push(now);if(taps.length===3){open(!opened);taps=[];} };
async function full() { try { if(document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch {} }
document.getElementById('full').onclick=full;
document.addEventListener('keydown',e=>{
 if(e.key==='Escape') open(false);
 if(/input|select|textarea/i.test(e.target.tagName) || e.ctrlKey || e.altKey || e.metaKey) return;
 if(e.key.toLowerCase()==='s') { e.preventDefault();open(!opened); }
 if(e.key.toLowerCase()==='f') full();
 if(e.key.toLowerCase()==='p') { location.hash=location.hash==='#demo'?'':'demo'; }
});
let touchTimer;
document.addEventListener('touchstart',e=>{clearTimeout(touchTimer);if(e.touches.length===2 && !side.contains(e.target)) touchTimer=setTimeout(()=>open(!opened),1200);},{passive:true});
for(const event of ['touchend','touchcancel','touchmove']) document.addEventListener(event,()=>clearTimeout(touchTimer),{passive:true});
document.addEventListener('contextmenu',e=>{if(!side.contains(e.target)) e.preventDefault();});
document.addEventListener('xray-start',()=>open(false));
window.addEventListener('hashchange',()=>location.reload());
let wake;
async function keepAwake(){try{if(!wake && document.visibilityState==='visible'){wake=await navigator.wakeLock?.request('screen');wake?.addEventListener('release',()=>wake=null);}}catch{}}
document.addEventListener('pointerdown',keepAwake,{once:true}); document.addEventListener('visibilitychange',keepAwake);
window.addEventListener('pagehide',()=>document.getElementById('video').srcObject?.getTracks().forEach(track=>track.stop()));
{
 const pane=document.createElement('section');pane.className='pane';pane.setAttribute('role','tabpanel');
 pane.innerHTML=`<div class="panel"><h3>Anomaly sequence</h3>${check('anOn','Run the anomaly')}${slider('anNear','Near threshold (face width)',.03,.4,.005)}${slider('anMax','Max people manifesting at once',1,6,1)}${slider('anStagger','Random start delay (s)',0,10,.5)}${slider('anReset','Reset after leaving (s)',.5,15,.5)}${slider('anCalm','Calm (s)',1,30,.5)}${slider('anWrong','Vitals go wrong (s)',1,30,.5)}${slider('anReveal','Manifestation (s)',1,30,.5)}${slider('anDrop','Signal lost (s)',.5,10,.5)}${slider('anVary','Random variation',0,.8,.05)}<div class="grid2"><button class="btn" id="anRestart">Restart sequence</button></div><p class="info">Only people closer than the near threshold run the sequence; others show plain bones. Stepping back pauses it, staying away resets it. When the manifestation slots are full, the rest wait at the end of “vitals go wrong”, nearest first.</p><p class="info">Each person runs on their own: calm → vitals go wrong → no vital signs, black eye sockets, skull cracks, a hand that belongs to no one → signal lost → again.</p></div>
 <div class="panel"><h3>Manifestations</h3>${check('anEyes','Black eye sockets')}${check('anCracks','Skull cracks')}${check('anHand','Extra hand bones')}<div class="row"><label for="palette">Bone color</label><select id="palette"><option value="bone">Old film bone</option><option value="blue">Medical blue</option></select></div>${slider('anVolume','Sound volume',0,1,.05)}<p class="info">Sound: heartbeat that slows and stumbles, a flat tone, static. It starts after the first click or key press.</p></div>`;
 const button=document.createElement('button');button.textContent='Anomaly';button.setAttribute('role','tab');
 panes.insertBefore(pane,panes.children[2]);tabs.insertBefore(button,tabs.children[2]);
 [...tabs.children].forEach((b,i)=>b.onclick=()=>selectTab(i));
}
const textNodes=[];
const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest('script,style')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
while(walker.nextNode()){const n=walker.currentNode;if(dict[n.textContent.trim()]) textNodes.push([n,n.textContent.trim()]);}
function translate(){
 document.documentElement.lang=lang==='zh'?'zh-CN':lang;
 textNodes.forEach(([n,original])=>n.textContent=t(original));
 document.querySelectorAll('[data-lang]').forEach(b=>b.classList.toggle('on',b.dataset.lang===lang));
 document.getElementById('cutlabel').textContent=t(document.getElementById('reveal').value==='lens'?'Lens size':'Cut position');
 const status=document.getElementById('status'); if(status.dataset.message) {status.textContent=translateStatus(status.dataset.message);document.getElementById('introStatus').textContent=status.textContent;}
 document.getElementById('hotspot').ariaLabel=t('Settings'); document.getElementById('close').ariaLabel=t('Close settings');
}
document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{lang=b.dataset.lang;try{localStorage.setItem('ghostXrayLang',lang);localStorage.setItem('ghostSeriesLang',lang);}catch{}translate();});
for(const range of document.querySelectorAll('input[type=range]')) {
 const number=document.createElement('input');number.type='number';number.className='nv'; for(const key of ['min','max','step']) number[key]=range[key];if(isFit(range.id)){number.removeAttribute('max');number.step='any';if(fitScale.has(range.id))number.min='.001';else number.removeAttribute('min');}number.setAttribute('aria-label',range.parentElement.querySelector('label').textContent.trim());range.after(number);
 const sync=()=>number.value=Number(range.value).toFixed(Number(range.step)>=1?0:Number(range.step)<0.01?3:2);
 range.addEventListener('input',sync);
 number.addEventListener('input',()=>{if(number.value==='' || !number.validity.valid)return;const v=Number(number.value);if(!Number.isFinite(v))return;ensureFitRange(range.id,v);range.value=String(v);range.dispatchEvent(new Event('input',{bubbles:true}));});
 number.addEventListener('change',()=>{const v=Number(number.value);if(isFit(range.id)){if(number.value===''||!Number.isFinite(v)||(fitScale.has(range.id)&&v<=0)){sync();return;}ensureFitRange(range.id,v);}range.value=String(Number.isFinite(v)?Math.min(Number(range.max),Math.max(Number(range.min),v)):Number(range.min));range.dispatchEvent(new Event('input',{bubbles:true}));sync();});
 document.addEventListener('xray-sync',sync); document.addEventListener('change',()=>{if(document.activeElement!==number)sync();});document.addEventListener('click',()=>queueMicrotask(()=>{if(document.activeElement!==number)sync();}));queueMicrotask(sync);
}
selectTab(0);translate();
