export class Proximity {
 constructor(){this.closed=false;this.nearAt=null;this.farAt=null;}
 update(width,now,cfg){
  if(cfg.testNear){this.closed=true;this.nearAt=null;this.farAt=null;return true;}
  const near=width>=cfg.nearRatio,far=width<=Math.min(cfg.farRatio,cfg.nearRatio-.005);
  if(!this.closed){this.farAt=null;if(near){this.nearAt??=now;if(now-this.nearAt>=cfg.enterHold*1000){this.closed=true;this.nearAt=null;}}else this.nearAt=null;}
  else{this.nearAt=null;if(far){this.farAt??=now;if(now-this.farAt>=cfg.leaveHold*1000){this.closed=false;this.farAt=null;}}else this.farAt=null;}
  return this.closed;
 }
}
export function seeded(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
