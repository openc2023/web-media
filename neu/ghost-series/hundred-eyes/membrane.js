// 百眼墙的画面合成（WebGL，一遍画完）：
//   背景（实拍或雾中窗格）→ 湿润的肉膜（眼睛之间，留出中间的空洞）→ 眼睛 → 往下流的水痕
// 肉膜的起伏来自 mask：R = 整体覆盖（中间挖空），G = 每只眼睛周围鼓起的眼眶。
// 法线由 mask 求导，加皮肤细纹 noise，打一盏左上的冷光 → 湿亮的高光。
const vertex = `attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 uv;
uniform sampler2D bg, eyes, mask, room, wall;
uniform vec2 res; uniform float time, mirror, fog, drip, dripSpeed, gloss, refr, camSat, camBright, tone, agit, eyeExp, eyeSat, camOn, roomA, wallA, wallSpeed, seeThrough;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=noise(p)*a;p=p*2.03+7.2;a*=.5;}return n;}
// 水痕：从上面流下来的黏稠水流，停在随机高度，末端挂一颗水珠慢慢往下坠，坠够了断开重来。
// 粗细沿着流向一鼓一鼓地往下走。返回 (中间亮光, 边缘暗线, 折射偏移)
vec3 drips(vec2 p, float cols, float seed){
  float cx=p.x*cols, id=floor(cx), fx=fract(cx)-.5;
  float r=hash(vec2(id,seed)), r2=hash(vec2(id,seed+4.1)), r3=hash(vec2(id,seed+8.3));
  if(r<.6) return vec3(0.);
  float sp=dripSpeed*(1.+agit*.9);
  float period=7.+r3*9., ph=fract(time*sp/period+r*7.);
  float endY=1.-(.18+r2*.72)-ph*.22;
  float y=p.y;
  if(y<endY-.04) return vec3(0.);
  float flow=noise(vec2(id*3.1,y*7.+time*sp*(.5+r2)));
  float bead=smoothstep(.04,0.,abs(y-endY+.005));
  float w=(.07+.11*r2)*(.5+.9*flow)+bead*(.1+.12*ph);
  float wob=.07*sin(y*5.+r*6.3)+.03*sin(y*17.+r3*4.);
  float t=(fx+wob)/w; if(abs(t)>=1.) return vec3(0.);
  float a=clamp(smoothstep(endY-.035,endY+.01,y)+bead,0.,1.);
  float hl=smoothstep(.3,0.,abs(t+.35)), rim=smoothstep(.6,1.,abs(t));
  return vec3(hl*a, rim*a, t*sqrt(1.-t*t)*a);
}
float H(vec2 p){vec4 m=texture2D(mask,p);return m.r*.45+m.g*.8+noise(p*vec2(70.,40.))*.05+noise(p*vec2(16.,9.))*.08;}
void main(){
  vec2 a=vec2(res.x/res.y,1.);
  vec3 d1=drips(uv*vec2(a.x,1.),20.,3.1), d2=drips(uv*vec2(a.x,1.)+vec2(.37,0.),38.,9.7);
  float dr=(d1.x+d2.x*.6)*drip, drim=(d1.y+d2.y*.6)*drip;
  vec2 off=vec2(d1.z+d2.z*.6,0.)*refr*min(drip,1.5)*.02;
  vec4 m=texture2D(mask,uv+off*.5);
  float n=fbm(uv*vec2(7.,4.)+3.7);
  float f=smoothstep(.32,.68,m.r*.85+m.g*.95+(n-.5)*.6);
  // 法线（湿肉的起伏）
  vec2 px=2./res;
  float hx=H(uv+vec2(px.x,0.))-H(uv-vec2(px.x,0.)), hy=H(uv+vec2(0.,px.y))-H(uv-vec2(0.,px.y));
  vec3 N=normalize(vec3(-hx*14.,-hy*14.,1.));
  vec3 L=normalize(vec3(-.45,.65,.62));
  float diff=max(dot(N,L),0.);
  float spec=pow(max(dot(reflect(-L,N),vec3(0.,0.,1.)),0.),36.)*gloss;
  float spec2=pow(max(dot(reflect(-normalize(vec3(.5,.3,.8)),N),vec3(0.,0.,1.)),0.),80.)*gloss*.6;
  // 背景：模糊、去色、冷青色调、起雾
  vec2 c=uv+off*1.6; if(mirror>.5) c.x=1.-c.x;
  vec3 b=vec3(0.);
  for(int i=0;i<5;i++){float t=float(i)*1.2566; b+=texture2D(bg,c+vec2(cos(t),sin(t))*.0022).rgb;} b=b/5.*.6+texture2D(bg,c).rgb*.4;
  float lum=dot(b,vec3(.299,.587,.114)); b=mix(vec3(lum),b,camSat)*camBright;
  b=mix(b,b*vec3(.72,.9,.95)+vec3(.03,.05,.06),.4);
  // 窗格红梅：有实拍时半透明叠在实拍上，没摄像头时就是背景本身
  vec3 rm=texture2D(room,uv+off*1.6).rgb;
  b=camOn>.5?mix(b,rm,roomA):mix(vec3(.1,.13,.14),rm,.4+.6*roomA);
  b=mix(b,vec3(.5,.58,.6)*(.55+.45*smoothstep(.9,.1,length((uv-.5)*vec2(1.3,1.8)))),fog);
  // 肉膜颜色：暗青灰，眼眶附近偏粉
  vec3 fl=mix(vec3(.13,.16,.18),vec3(.36,.25,.27),smoothstep(.2,.9,m.g))*tone;
  fl*= .45+.75*diff;
  fl+= (fbm(uv*vec2(90.,50.))-.5)*.05;
  fl+= spec*vec3(.72,.84,.9)+spec2*vec3(.9,.95,1.);
  vec3 col=mix(b,fl,f);
  // 空洞里也蒙着一层很薄的湿膜：一点灰、一点高光，像隔着一层胶看后面的房间
  float film=(1.-f)*.26;
  col=mix(col,col*.78+vec3(.07,.09,.1)+(spec*.5+spec2*.4)*vec3(.8,.88,.92),film);
  // 膜的边缘：薄的半透明湿边
  float edge=smoothstep(.0,.12,f)*smoothstep(.45,.12,f);
  col+=edge*vec3(.25,.32,.35)*.22;
  // 眼睛
  vec4 e=texture2D(eyes,uv+off*.35);
  float el=dot(e.rgb,vec3(.299,.587,.114)); e.rgb=((mix(vec3(el),e.rgb,eyeSat)*eyeExp)-.5)*1.06+.5;
  col=mix(col,e.rgb*vec3(.9,.95,1.)+vec3(0.,.01,.02),e.a);
  col+=e.a*(spec*.35+spec2*.5)*vec3(.85,.9,.95);
  // 水痕：提亮 + 珠子高光
  col*=1.-clamp(drim,0.,1.)*.4;
  col+=dr*vec3(.5,.58,.62)*.22+pow(clamp(dr,0.,1.),5.)*vec3(.5,.55,.58);
  // 中间一圈眼睛和肉膜稍微透明，能隐约看见后面的实拍
  float ck=smoothstep(.85,.1,length((uv-vec2(.5,.53))*vec2(1.1,1.55)))*seeThrough;
  col=mix(col,b*1.08,ck*(.55+.45*f));
  // 最前面一层半透明的流动水墙（assets/water-wall.png）：扭动 + 焦散高光
  vec2 wq=uv*.84+.08;   // 只取图的中间，图边缘那圈波浪白边不进画面
  vec2 wf=vec2(noise(wq*4.+vec2(time*.21,-time*.17)*wallSpeed),noise(wq*4.+vec2(-time*.15,time*.23)*wallSpeed+11.))-.5;
  vec4 wt=texture2D(wall,wq+wf*.035+vec2(sin(time*.07*wallSpeed)*.012,cos(time*.05*wallSpeed)*.012));
  float wl=dot(wt.rgb,vec3(.299,.587,.114));
  col=mix(col,wt.rgb*1.05,wt.a*wallA*(.35+.65*wl));
  col+=wt.rgb*pow(wl,3.)*wallA*.9;
  // 调色：暗部偏青，压一点对比
  col=pow(max(col,0.),vec3(1.06));
  col=mix(col,col*vec3(.88,.98,1.02),.5);
  gl_FragColor=vec4(col,1.);
}`;

export function createMembrane(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL unavailable');
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vertex)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  gl.useProgram(p);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(p, 'position'); gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(['bg', 'eyes', 'mask', 'res', 'time', 'mirror', 'fog', 'drip', 'dripSpeed', 'gloss', 'refr', 'camSat', 'camBright', 'tone', 'agit', 'eyeExp', 'eyeSat', 'room', 'wall', 'camOn', 'roomA', 'wallA', 'wallSpeed', 'seeThrough'].map(k => [k, gl.getUniformLocation(p, k)]));
  const tex = unit => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); return t; };
  const T = { bg: tex(0), eyes: tex(1), mask: tex(2), room: tex(3), wall: tex(4) };
  gl.uniform1i(U.bg, 0); gl.uniform1i(U.eyes, 1); gl.uniform1i(U.mask, 2); gl.uniform1i(U.room, 3); gl.uniform1i(U.wall, 4);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const upload = (unit, source) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, T[['bg', 'eyes', 'mask', 'room', 'wall'][unit]]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); };
  return {
    setBackground(source) { if (source && source.width) upload(0, source); },
    setMask(source) { upload(2, source); },
    setRoom(source) { upload(3, source); },
    setWall(source) { upload(4, source); },
    draw(now, cfg, eyesCanvas, mirror, agit, isCam = true) {
      upload(1, eyesCanvas);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.res, canvas.width, canvas.height); gl.uniform1f(U.time, now * .001);
      gl.uniform1f(U.mirror, mirror ? 1 : 0); gl.uniform1f(U.fog, cfg.fog); gl.uniform1f(U.drip, cfg.drip); gl.uniform1f(U.dripSpeed, cfg.dripSpeed);
      gl.uniform1f(U.gloss, cfg.gloss); gl.uniform1f(U.refr, cfg.refraction); gl.uniform1f(U.camSat, isCam ? cfg.cameraSaturation : .95); gl.uniform1f(U.camBright, isCam ? cfg.cameraExposure : 1);
      gl.uniform1f(U.tone, cfg.fleshTone); gl.uniform1f(U.agit, agit); gl.uniform1f(U.eyeExp, cfg.eyeExposure); gl.uniform1f(U.eyeSat, cfg.eyeSaturation); gl.uniform1f(U.camOn, isCam ? 1 : 0); gl.uniform1f(U.roomA, cfg.roomOpacity); gl.uniform1f(U.wallA, cfg.waterOpacity); gl.uniform1f(U.wallSpeed, cfg.waterSpeed); gl.uniform1f(U.seeThrough, cfg.seeThrough);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
  };
}

// 没有摄像头时的背景：雾里的两扇格子窗和几枝红梅（程序画的，和参考图同一种气氛）
export function drawRoom(W = 1280, H = 720) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const sky = g.createRadialGradient(W / 2, H * .5, H * .05, W / 2, H * .5, W * .6);
  sky.addColorStop(0, '#b9c6c8'); sky.addColorStop(.45, '#7c8b8e'); sky.addColorStop(1, '#2b3336'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const lattice = (x, y, w, h) => {
    g.strokeStyle = 'rgba(30,36,38,.9)'; g.lineWidth = 6; g.strokeRect(x, y, w, h);
    g.lineWidth = 3; const nx = 3, ny = 5;
    for (let i = 1; i < nx; i++) { g.beginPath(); g.moveTo(x + w * i / nx, y); g.lineTo(x + w * i / nx, y + h); g.stroke(); }
    for (let j = 1; j < ny; j++) { g.beginPath(); g.moveTo(x, y + h * j / ny); g.lineTo(x + w, y + h * j / ny); g.stroke(); }
    g.lineWidth = 1.4; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if ((i + j) % 2 === 0) g.strokeRect(x + w * i / nx + w / nx * .22, y + h * j / ny + h / ny * .22, w / nx * .56, h / ny * .56);
  };
  lattice(W * .27, H * .2, W * .17, H * .58); lattice(W * .56, H * .2, W * .17, H * .58);
  g.fillStyle = 'rgba(150,165,168,.35)'; g.fillRect(0, H * .78, W, H * .22);
  // 红梅：几根弯枝，枝上一簇簇五瓣花
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const blossom = (x, y, k) => { g.fillStyle = `rgba(${165 + r() * 40 | 0},${16 + r() * 18 | 0},${26 + r() * 14 | 0},.96)`;
    for (let i = 0; i < 5; i++) { const t = i / 5 * 6.283; g.beginPath(); g.arc(x + Math.cos(t) * 5 * k, y + Math.sin(t) * 5 * k, 4.6 * k, 0, 6.3); g.fill(); }
    g.fillStyle = '#e8c07a'; g.beginPath(); g.arc(x, y, 1.1 * k, 0, 6.3); g.fill(); };
  const branch = (x, y, ang, len, depth) => {
    g.strokeStyle = 'rgba(28,20,18,.95)'; g.lineWidth = Math.max(1.4, 5 - depth * 1.6); g.lineCap = 'round';
    let px = x, py = y;
    for (let i = 0; i < 6; i++) {
      ang += (r() - .5) * .7; const nx = px + Math.cos(ang) * len / 6, ny = py + Math.sin(ang) * len / 6;
      g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke(); px = nx; py = ny;
      if (r() < .5) blossom(px + (r() - .5) * 14, py + (r() - .5) * 14, .65 + r() * .5);
      if (depth < 2 && r() < .3) branch(px, py, ang + (r() - .5) * 1.8, len * .45, depth + 1);
    }
  };
  branch(W * .33, H * .44, -.3, W * .17, 0); branch(W * .7, H * .56, -2.7, W * .15, 0); branch(W * .47, H * .3, .7, W * .08, 1);
  g.filter = 'blur(.6px)'; g.drawImage(c, 0, 0); g.filter = 'none';
  return c;
}
