export async function imageFile(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Asset missing: '+url));image.src=url;});}
// Runtime matte removal only: original GIFs and decoded PNG assets remain unchanged.
export function removeEdgeBackground(image){
 const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);
 const im=g.getImageData(0,0,c.width,c.height),d=im.data,w=c.width,h=c.height,visited=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
 const colors=[];for(let i=0;i<12;i++){for(const [x,y]of [[Math.floor(i*(w-1)/11),0],[Math.floor(i*(w-1)/11),h-1],[0,Math.floor(i*(h-1)/11)],[w-1,Math.floor(i*(h-1)/11)]]){const p=(y*w+x)*4;colors.push([d[p],d[p+1],d[p+2]]);}}
 const near=p=>d[p+3]<8||colors.some(c=>Math.max(Math.abs(d[p]-c[0]),Math.abs(d[p+1]-c[1]),Math.abs(d[p+2]-c[2]))<24);
 const add=i=>{if(i<0||i>=w*h||visited[i])return;visited[i]=1;if(near(i*4))queue[tail++]=i;};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
 while(head<tail){const i=queue[head++],x=i%w;d[i*4+3]=0;if(x>0)add(i-1);if(x<w-1)add(i+1);add(i-w);add(i+w);}
 let left=w,top=h,right=0,bottom=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(d[(y*w+x)*4+3]>24){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 g.putImageData(im,0,0);return {canvas:c,bounds:{left,top,right,bottom}};
}
export async function loadEyes(){
 const sets=[];
 for(const prefix of ['eye','eye-b']){
  const meta=await fetch(`assets/${prefix}-frames.json`).then(r=>{if(!r.ok)throw new Error('Eye manifest missing');return r.json();});
  const frames=[],bounds={left:Infinity,top:Infinity,right:0,bottom:0};
  for(let i=0;i<meta.count;i++){
   const result=removeEdgeBackground(await imageFile(`assets/${prefix}-${i}.png`));frames.push(result.canvas);
   bounds.left=Math.min(bounds.left,result.bounds.left);bounds.top=Math.min(bounds.top,result.bounds.top);bounds.right=Math.max(bounds.right,result.bounds.right);bounds.bottom=Math.max(bounds.bottom,result.bounds.bottom);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  bounds.width=bounds.right-bounds.left+1;bounds.height=bounds.bottom-bounds.top+1;sets.push({frames,bounds});
 }
 return sets;
}
