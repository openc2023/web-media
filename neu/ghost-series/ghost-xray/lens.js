// A fingertip lens has no face, mouse or screen-center fallback.
export function handLens(hands,W,H,cut,mirror){
 const tip=hands[0]?.[8];
 if(!tip||!Number.isFinite(tip.x)||!Number.isFinite(tip.y)||tip.x<0||tip.x>1||tip.y<0||tip.y>1)return null;
 const cx=tip.x*W,cy=tip.y*H,r=(.07+.38*cut)*W;
 return {cx,cy,x:mirror?W-cx:cx,y:cy,r};
}
