let model,key='';
const options=cfg=>({numFaces:cfg.maxFaces,minFaceDetectionConfidence:cfg.faceConfidence,minFacePresenceConfidence:cfg.faceConfidence,minTrackingConfidence:cfg.faceConfidence});
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const vision=await import('./vendor/mediapipe/vision_bundle.mjs');
   const files=await vision.FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm/',self.location.href).href);
   model=await vision.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('../models/face_landmarker.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',...options(data.cfg),outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false});
   key=JSON.stringify(options(data.cfg));self.postMessage({type:'ready'});
  }
  if(data.type==='frame'){
   const o=options(data.cfg),next=JSON.stringify(o);if(next!==key){await model.setOptions(o);key=next;}
   const result=model.detectForVideo(data.image,data.time);
   const faces=(result.faceLandmarks||[]).map(lms=>{let left=1,right=0,top=1,bottom=0;for(const p of lms){left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.y);bottom=Math.max(bottom,p.y);}return {x:(left+right)/2,y:(top+bottom)/2,w:right-left,h:bottom-top,left,top};});
   self.postMessage({type:'result',faces,epoch:data.epoch,time:data.time});
  }
 }catch(e){self.postMessage({type:'error',message:e.message||String(e)});}
 finally{data.image?.close();}
};
