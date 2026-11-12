import {faceBox} from './tracking.js?v=0.3.0';
// Require plausible landmarks and several consecutive detections; never hold a lost hand.
export class HandFilter {
 constructor(){this.reset();}
 reset(){this.candidates=[];}
 update(detections,now,{minSize=.04,frames=3,maxGap=300}={}){
  const previous=this.candidates,used=new Set(),next=[],accepted=[];
  for(const detection of detections.slice(0,2)){
   const lms=detection.lms;
   if(lms?.length!==21||!lms.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.08&&p.x<=1.08&&p.y>=-.08&&p.y<=1.08))continue;
   const box=faceBox(lms);if(Math.max(box.w,box.h)<minSize||Math.min(box.w,box.h)<minSize*.25)continue;
   const wrist=lms[0],index=lms[5],little=lms[17];
   const area=Math.abs((index.x-wrist.x)*(little.y-wrist.y)-(index.y-wrist.y)*(little.x-wrist.x));
   if(area<box.w*box.h*.002)continue;
   let best=-1,distance=Infinity;
   previous.forEach((p,i)=>{const d=Math.hypot(p.box.x-box.x,p.box.y-box.y);if(!used.has(i)&&now-p.seen<=maxGap&&d<Math.max(.08,box.w)&&d<distance){best=i;distance=d;}});
   if(best!==-1)used.add(best);
   const entry={box,seen:now,count:best===-1?1:previous[best].count+1};next.push(entry);
   if(entry.count>=frames)accepted.push(detection);
  }
  this.candidates=next;return accepted;
 }
}
