// Anonymous spatial slots only: no facial recognition or biometric identity.
export function faceBox(lms) {
 const points=lms.filter(Boolean);
 if(!points.length)return null;
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 return {x:(left+right)/2,y:(top+bottom)/2,w:right-left,h:bottom-top,left,top};
}

export function matchFaces(tracks,detections,now,grace,limit,priority='near') {
 const active=tracks.filter(t=>t.id<limit && t.box && now-t.seen<=grace);
 const pairs=[];
 for(const track of active) for(let i=0;i<detections.length;i++) {
  const box=detections[i].box;
  const dt=Math.min(0.25,Math.max(0,(now-track.seen)/1000));
  const dx=box.x-(track.box.x+(track.vx||0)*dt),dy=box.y-(track.box.y+(track.vy||0)*dt);
  const distance=Math.hypot(dx,dy),scale=Math.abs(Math.log(Math.max(.001,box.w)/Math.max(.001,track.box.w)));
  const gate=Math.max(.09,Math.min(.28,track.box.w*1.4));
  if(distance<gate && scale<.9)pairs.push({track,index:i,cost:distance+scale*.04});
 }
 pairs.sort((a,b)=>a.cost-b.cost);
 const used=new Set(),assigned=new Map();
 for(const pair of pairs)if(!assigned.has(pair.track.id)&&!used.has(pair.index)){assigned.set(pair.track.id,pair.index);used.add(pair.index);}
 const remaining=detections.map((d,i)=>({d,i})).filter(p=>!used.has(p.i));
 remaining.sort((a,b)=>priority==='center'?Math.hypot(a.d.box.x-.5,a.d.box.y-.5)-Math.hypot(b.d.box.x-.5,b.d.box.y-.5):b.d.box.w-a.d.box.w);
 // Keep temporarily occluded slots reserved until their grace expires.
 const free=tracks.filter(t=>t.id<limit&&!assigned.has(t.id)&&(!t.box||now-t.seen>grace));
 for(const slot of free){const next=remaining.shift();if(!next)break;assigned.set(slot.id,next.i);}
 return assigned;
}
