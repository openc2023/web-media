export class Detector{
 constructor(cfg,onFaces,onStatus){
  this.ready=false;this.busy=false;this.closed=false;this.onStatus=onStatus;
  this.worker=new Worker(new URL('./face-worker.js?v=0.3.1',import.meta.url));
  const fail=message=>{if(this.closed)return;this.closed=true;clearTimeout(this.timer);this.worker.terminate();this.busy=false;onStatus(message,true);};
  this.worker.onerror=e=>fail(e.message||'Detection worker failed');
  this.worker.onmessage=({data})=>{clearTimeout(this.timer);if(data.type==='ready'){this.ready=true;onStatus('ready',false);}else if(data.type==='result'){this.busy=false;onFaces(data);}else if(data.type==='error')fail(data.message);};
  this.timer=setTimeout(()=>fail('Detection timeout. Camera preview continues.'),30000);
  this.worker.postMessage({type:'init',cfg:{maxFaces:cfg.maxFaces,faceConfidence:cfg.faceConfidence}});this.fail=fail;
 }
 async send(canvas,time,cfg,epoch){
  if(!this.ready||this.busy||this.closed)return;this.busy=true;
  try{
   const scale=Math.min(1,640/Math.max(canvas.width,canvas.height));
   const image=await createImageBitmap(canvas,{resizeWidth:Math.max(2,Math.round(canvas.width*scale)),resizeHeight:Math.max(2,Math.round(canvas.height*scale)),resizeQuality:'low'});
   if(this.closed){image.close();return;}
   this.timer=setTimeout(()=>this.fail('Detection timeout. Camera preview continues.'),10000);
   this.worker.postMessage({type:'frame',image,time,epoch,cfg:{maxFaces:cfg.maxFaces,faceConfidence:cfg.faceConfidence}},[image]);
  }catch(e){this.fail(e.message);}
 }
 close(){this.closed=true;clearTimeout(this.timer);this.worker.terminate();this.busy=false;}
}
