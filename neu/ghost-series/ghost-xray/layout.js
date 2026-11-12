export const overlaps=(a,b)=>a.x<b.x+b.w+6&&a.x+a.w+6>b.x&&a.y<b.y+b.h+6&&a.y+a.h+6>b.y;
export function placeCard(ideal,w,h,W,H,heads,occupied,previous){
 const valid=r=>r.x>=6&&r.y>=24&&r.x+r.w<=W-6&&r.y+r.h<=H-6&&!heads.some(b=>overlaps(r,b))&&!occupied.some(b=>overlaps(r,b));
 if(previous&&valid({...previous,w,h}))return {...previous,w,h};
 const candidates=[];
 const add=(x,y)=>{const r={x:Math.max(6,Math.min(W-w-6,x)),y:Math.max(24,Math.min(H-h-6,y)),w,h};if(valid(r))candidates.push(r);};
 add(ideal.x,ideal.y);
 for(let y=24;y<=H-h-6;y+=24)for(let x=6;x<=W-w-6;x+=24)add(x,y);
 candidates.sort((a,b)=>Math.hypot(a.x-ideal.x,a.y-ideal.y)-Math.hypot(b.x-ideal.x,b.y-ideal.y));
 return candidates[0]||null;
}
