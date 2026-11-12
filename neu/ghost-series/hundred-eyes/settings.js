export const DEFAULTS={lang:'zh',deviceId:'',resolution:'720',rotation:0,mirror:true,maxFaces:6,faceConfidence:.5,nearRatio:.14,farRatio:.1,enterHold:.2,leaveHold:1.2,detectHz:8,debug:false,testNear:false,
 // 眼睛：数量、大小、挤在一起的程度、中间空洞、两种眼睛的比例
 count:72,layoutSeed:5005,eyeSpacing:.04,overlap:.12,gap:.85,eyeScale:1.05,sizeVariation:.85,eyeMix:.28,eyeOpacity:1,eyeExposure:.86,eyeSaturation:.72,rotationSpread:16,
 openDelay:5,closeDuration:.28,openDuration:.6,blinkInterval:5,
 // 画面：背景、肉膜、湿润高光、水痕、雾
 bgMode:'auto',roomOpacity:.32,seeThrough:.45,waterOpacity:.3,waterSpeed:.8,fleshCover:.62,fleshTone:1,gloss:1,drip:1,dripSpeed:1,refraction:1,fog:.18,cameraSaturation:.6,cameraExposure:.9,vignette:.45};
const KEY='ghostHundredEyes.v2';
export function loadSettings(){let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}');}catch{}
 const result={...DEFAULTS,...saved};result.testNear=false;return result;
}
export function saveSettings(cfg){try{localStorage.setItem(KEY,JSON.stringify(cfg));}catch{}}
