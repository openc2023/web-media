// ======================== 参数 ========================
const PARAMS = {
  // 同时存在的脉冲线数量（保持 2–5 随机，不平均）
  minLines: 4, maxLines: 6,

  // 每条线内部"多峰"形状（3–6 随机峰）
  minPeaks: 3, maxPeaks: 6,
  minSeparation: 0.04,     // 峰之间建议最小间隔（相对宽度）；30% 概率忽略，打破平均

  // 上升速度与整体幅度
  minSpeed: 140, maxSpeed: 220, // px/s
  minAmp: 60,  maxAmp: 160,     // 像素

  // 单峰宽度（相对画布宽度，越大越"胖"）
  minSigma: 0.035, maxSigma: 0.14,

  // 噪声（线条细微抖动）
  noiseAmp: 8,                   // 像素
  noiseFreq1: 5.5, noiseFreq2: 11.0,
  noiseSpeed1: 0.8, noiseSpeed2: 1.35,

  // 峰中心轻微漂移（每个峰独立相位）
  centerDriftAmp: 0.05,          // 相对宽度
  centerDriftSpeed: 0.28,        // 周期速度（Hz 近似）

  // 到达顶部 90% 开始把"峰+噪声"淡出 → 直线
  topFlattenStart: 0.90,

  // 残影（画布整体拖影）
  useTrail: false,
  fadeAlpha: 0.10,

  // —— 底层线条更弱 ——
  lineWidth: 1.4,
  strokeStyle: 'rgba(230,240,255,0.45)', // 更淡
  glowColor: 'rgba(150,180,255,0.25)',
  glowBlur: 4,

  // —— 整条线"垂直渐变拖尾"设置 ——
  tailLenBase: 120,        // 基础长度（像素）
  tailSpacing: 5,          // 层间距（像素）
  tailLayersMax: 24,       // 最大层数（自动按长度裁剪）
  tailAlphaTop: 0.22,      // 紧贴主线的透明度
  tailAlphaBottom: 0.00,   // 尾部最远端透明度
  tailWidthTopMul: 1.0,    // 顶端线宽乘数（相对于主线宽）
  tailWidthBottomMul: 0.70,// 底端线宽乘数
  tailColor: '#b9d6ff',
  tailGlowBlur: 6,
  
  // 性能优化参数
  useRequestAnimationFrame: true, // 使用requestAnimationFrame进行动画
  throttleFPS: 60,               // 限制最大FPS
  useCachedMath: true,           // 使用缓存的数学计算
  useOffscreenCanvas: false,     // 是否使用离屏Canvas (浏览器支持时启用)
  
  // 音频可视化参数
  audioVisualization: true,      // 是否启用音频可视化
  audioAmpMultiplier: 1.5,       // 音频幅度乘数
  audioFreqRangeStart: 0.1,      // 音频频率范围起始点 (0-1)
  audioFreqRangeEnd: 0.5,        // 音频频率范围结束点 (0-1)
  audioSmoothFactor: 0.6,        // 音频平滑因子 (0-1)
};

// ======================== 画布（强制 9:16 居中 + 留黑边） ========================
const wrap = document.getElementById('wrap');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
let W = 0, H = 0; // CSS 像素

// 小型音频可视化画布
let miniCanvas = null;
let miniCtx = null;
let miniW = 0, miniH = 0;

// ======================== 音频可视化相关 ========================
let audioContext = null;
let analyser = null;
let audioElement = null;
let dataArray = null;
let audioSource = null;
let smoothedAudioValue = 0;
let audioInitialized = false;

// 初始化小型音频可视化器
function initMiniVisualizer() {
  try {
    miniCanvas = document.getElementById('miniVisualizer');
    if (miniCanvas) {
      miniCtx = miniCanvas.getContext('2d');
      // 设置画布尺寸
      const glassPanel = document.querySelector('.glass-panel');
      if (glassPanel) {
        const rect = glassPanel.getBoundingClientRect();
        miniW = rect.width * 0.8; // 占玻璃面板宽度的80%
        miniH = 40; // 调整高度为40px，确保温度信息完整显示
        miniCanvas.width = miniW * dpr;
        miniCanvas.height = miniH * dpr;
        miniCanvas.style.width = `${miniW}px`;
        miniCanvas.style.height = `${miniH}px`;
        miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
  } catch (error) {
    console.error('小型音频可视化器初始化失败:', error);
  }
}

function initAudio() {
  try {
    // 创建音频上下文
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioElement = document.getElementById('audio');
    
    // 创建分析器节点
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // FFT大小，较小的值更快但精度较低
    
    // 创建数据数组来存储分析结果
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    // 连接音频源到分析器
    audioSource = audioContext.createMediaElementSource(audioElement);
    audioSource.connect(analyser);
    analyser.connect(audioContext.destination);
    
    audioInitialized = true;
    
    // 添加点击事件以开始播放音频（用户交互要求）
    canvas.addEventListener('click', () => {
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
      if (audioElement.paused) {
        audioElement.play().catch(e => {
          console.error('音频播放失败:', e);
          // 即使播放失败，也继续执行动画
          PARAMS.audioVisualization = false;
        });
      }
    });
    
    // 监听音频错误事件
    audioElement.addEventListener('error', (e) => {
      console.error('音频元素错误:', e);
      PARAMS.audioVisualization = false;
    });
  } catch (error) {
    console.error('音频初始化失败:', error);
    PARAMS.audioVisualization = false; // 如果初始化失败，禁用音频可视化
  }
}

// 釜山天气数据 - 由于是模拟环境，使用模拟数据
let busanWeatherData = {
  temperature: 22, // 温度(°C)
  humidity: 65,    // 湿度(%)
  windSpeed: 15,   // 风速(km/h)
  lastUpdate: new Date().toLocaleTimeString()
};

// 更新天气数据的函数 - 优化版
let lastWeatherUpdateTime = 0;
const weatherUpdateFrequency = 1000; // 1秒更新一次，足够平滑且不过于频繁

function updateBusanWeather() {
  const now = performance.now();
  if (now - lastWeatherUpdateTime < weatherUpdateFrequency) {
    return; // 跳过更新
  }
  
  lastWeatherUpdateTime = now;
  
  // 在实际应用中，这里会调用天气API获取实时数据
  // 由于是模拟环境，我们随机生成一些接近实际值的波动数据
  const simulationTime = now / 1000;
  
  // 添加小波动来模拟实时变化
  const tempVariation = Math.sin(simulationTime * 0.1) * 0.5;
  const humidityVariation = Math.sin(simulationTime * 0.2 + 1) * 2;
  const windVariation = Math.sin(simulationTime * 0.3 + 2) * 1.5;
  
  // 更新数据
  busanWeatherData = {
    temperature: Math.round((22 + tempVariation) * 10) / 10,
    humidity: Math.round(65 + humidityVariation),
    windSpeed: Math.round((15 + windVariation) * 10) / 10,
    lastUpdate: new Date().toLocaleTimeString()
  };
}

// 绘制天气数据可视化线条 - 优化版
function drawMiniVisualizer(audioLevel) {
  if (!miniCtx) return;
  
  // 清除画布 - 不使用随机跳过，而是通过优化绘制减少性能消耗
  miniCtx.clearRect(0, 0, miniW, miniH);
  
  // 更新天气数据 - 已经在主循环中更新，这里不需要再更新
  
  // 配置可视化参数
  const lineCount = 3; // 线条数量
  
  // 为三条线条设置对应的颜色 - 温度(红色)、湿度(蓝色)、风速(绿色)
  const lineColors = [
    'rgba(255, 120, 120, 0.7)', // 温度 - 红色
    'rgba(120, 150, 255, 0.6)', // 湿度 - 蓝色
    'rgba(120, 255, 120, 0.5)'  // 风速 - 绿色
  ];
  // 磨砂玻璃效果(阴影)颜色与线条颜色对应
  const glowColors = [
    'rgba(255, 120, 120, 0.4)', // 温度阴影 - 红色
    'rgba(120, 150, 255, 0.3)', // 湿度阴影 - 蓝色
    'rgba(120, 255, 120, 0.2)'  // 风速阴影 - 绿色
  ];
  const lineWidths = [2, 1.5, 1.2]; // 线条宽度
  const maxLineHeight = miniH * 0.5; // 进一步减少最大线条高度，确保与文本分离
  const lineSpacing = miniH * 0.15; // 增加线条间距，提高可读性
  
  // 性能优化：预先计算共享值
  const simulationTime = performance.now() / 1000;
  
  // 绘制三条天气数据线条
  for (let l = 0; l < lineCount; l++) {
    const lineColor = lineColors[l];
    const glowColor = glowColors[l];
    const lineWidth = lineWidths[l];
    const yOffset = (lineCount - l - 1) * lineSpacing; // 线条垂直偏移
    
    // 优化上下文状态设置
    miniCtx.shadowColor = glowColor;
    miniCtx.shadowBlur = 3; // 减少模糊效果提高性能
    miniCtx.strokeStyle = lineColor;
    miniCtx.lineWidth = lineWidth;
    miniCtx.beginPath();
    
    // 减少点数提高性能
    const pointCount = 15; // 每条线的点数减少一半
    
    // 性能优化：批量计算点位置
    for (let i = 0; i < pointCount; i++) {
      // 根据线条类型获取相应的天气数据值
      let weatherValue = 0;
      let minValue = 0;
      let maxValue = 100;
      
      // 根据线条索引选择不同的天气指标
      if (l === 0) { // 温度
        weatherValue = busanWeatherData.temperature;
        minValue = 0;    // 最低温度范围
        maxValue = 40;   // 最高温度范围
      } else if (l === 1) { // 湿度
        weatherValue = busanWeatherData.humidity;
        minValue = 0;    // 最低湿度范围
        maxValue = 100;  // 最高湿度范围
      } else if (l === 2) { // 风速
        weatherValue = busanWeatherData.windSpeed;
        minValue = 0;    // 最低风速范围
        maxValue = 30;   // 最高风速范围
      }
      
      // 将天气值标准化到0-1范围
      const normalizedValue = (weatherValue - minValue) / (maxValue - minValue);
      
      // 添加波动来创建更自然的波形
      const waveFactor = 0.1; // 波动幅度
      const wave = Math.sin(i * 1.0 + simulationTime * 0.5 + l * 1.5) * waveFactor;
      
      // 计算线条高度，应用音频影响
      const audioInfluence = audioLevel * 0.2; // 音频对小型可视化器的影响
      const lineHeight = Math.max(0, Math.min(maxLineHeight, (normalizedValue + wave + audioInfluence) * maxLineHeight));
      
      // 计算点的位置
      const x = (i / (pointCount - 1)) * miniW;
      const y = miniH - lineHeight - yOffset - (miniH - maxLineHeight) / 2; // 再稍微向下移动线条，确保与文本分离
      
      // 绘制线条
      if (i === 0) {
        miniCtx.moveTo(x, y);
      } else {
        miniCtx.lineTo(x, y);
      }
    }
    
    miniCtx.stroke();
  }
  
  // 绘制天气数据文本 - 确保每一帧都绘制，避免闪烁
  // 优化文本渲染
  miniCtx.font = '8px Arial'; // 减小字体大小，确保完整显示
  miniCtx.textAlign = 'center';
  
  // 使用原始的固定文本颜色
  
  // 显示温度 - 颜色与温度线条对应，移动到线条下方，确保不重叠
    miniCtx.fillStyle = 'rgba(255, 120, 120, 0.9)'; // 增加不透明度提高可读性
    miniCtx.fillText(`TEMP: ${busanWeatherData.temperature}°C`, miniW * 0.2, miniH - 5);
    
    // 显示湿度 - 颜色与湿度线条对应，移动到线条下方，确保不重叠
    miniCtx.fillStyle = 'rgba(120, 150, 255, 0.9)'; // 增加不透明度提高可读性
    miniCtx.fillText(`HUM: ${busanWeatherData.humidity}%`, miniW * 0.5, miniH - 5);
    
    // 显示风速 - 颜色与风速线条对应，移动到线条下方，确保不重叠
    miniCtx.fillStyle = 'rgba(120, 255, 120, 0.9)'; // 增加不透明度提高可读性
    miniCtx.fillText(`WIND: ${busanWeatherData.windSpeed}km/h`, miniW * 0.8, miniH - 5);
  
  // 重置阴影效果
  miniCtx.shadowBlur = 0;
}

function getAudioLevel() {
  if (!analyser || !PARAMS.audioVisualization) {
    return 0;
  }
  
  try {
    // 获取频域数据
    analyser.getByteFrequencyData(dataArray);
    
    // 计算指定频率范围内的平均水平
    const startIndex = Math.floor(dataArray.length * PARAMS.audioFreqRangeStart);
    const endIndex = Math.floor(dataArray.length * PARAMS.audioFreqRangeEnd);
    let sum = 0;
    let count = 0;
    
    for (let i = startIndex; i < endIndex; i++) {
      sum += dataArray[i];
      count++;
    }
    
    // 计算平均值并标准化到0-1范围
    const avg = count > 0 ? sum / count : 0;
    const normalized = avg / 255; // 255是Uint8Array的最大值
    
    // 应用平滑处理
    smoothedAudioValue = smoothedAudioValue * PARAMS.audioSmoothFactor + normalized * (1 - PARAMS.audioSmoothFactor);
    
    // 应用幅度乘数
    return Math.min(1, smoothedAudioValue * PARAMS.audioAmpMultiplier);
  } catch (error) {
    console.error('获取音频电平失败:', error);
    return 0;
  }
}

function resize(){
  const aspect = 9/16; // 竖版比例
  const vw = Math.floor(window.innerWidth);
  const vh = Math.floor(window.innerHeight);

  let cssW, cssH;
  if (vw / vh > aspect) { cssH = vh; cssW = Math.floor(cssH * aspect); }
  else { cssW = vw; cssH = Math.floor(cssW / aspect); }

  wrap.style.width  = cssW + 'px';
  wrap.style.height = cssH + 'px';

  canvas.width  = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.width  = '100%';
  canvas.style.height = '100%';
  ctx.setTransform(dpr,0,0,dpr,0,0);

  W = cssW; H = cssH;
}
window.addEventListener('resize', resize);
resize();

// ======================== 小工具 ========================
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp  = (a,b,t) => a + (b-a)*t;
const smooth01 = (x)=>{ x = clamp(x,0,1); return x*x*(3-2*x); };

// 轻量噪声
function noise1(u, t, seed){
  // 使用缓存的sin计算以提高性能
  const sinFunc = PARAMS.useCachedMath ? cachedSin : Math.sin;
  const a = sinFunc( (u * PARAMS.noiseFreq1 + t * PARAMS.noiseSpeed1 + seed) * Math.PI * 2 );
  const b = sinFunc( (u * PARAMS.noiseFreq2 + t * PARAMS.noiseSpeed2 + seed*1.718) * Math.PI * 2 );
  return a * 0.66 + b * 0.34;
}

// 高斯（钟形）
function gauss(u, mu, sigma){
  const d = (u - mu) / sigma;
  // 使用缓存的exp计算以提高性能
  return PARAMS.useCachedMath ? cachedExp(-0.5 * d * d) : Math.exp(-0.5 * d * d);
}

function ampScaleForLine(line){
  const progress = clamp(1 - (line.y / H), 0, 1);
  if(progress < PARAMS.topFlattenStart) return 1;
  const tt = (progress - PARAMS.topFlattenStart) / (1 - PARAMS.topFlattenStart);
  return 1 - smooth01(tt);
}

// ======================== 脉冲线（每条线内部是"多峰之和"） ========================
function newLine(){
  const speed = lerp(PARAMS.minSpeed, PARAMS.maxSpeed, Math.random());
  const amp   = lerp(PARAMS.minAmp,  PARAMS.maxAmp,  Math.random());

  // 峰数：3~6 随机
  const k = Math.floor(lerp(PARAMS.minPeaks, PARAMS.maxPeaks + 1, Math.random()));

  // 生成 k 个峰：位置/宽度/权重/相位随机（不平均）
  const peaks = [];
  const marginL = 0.10, marginR = 0.90;
  const triesPerPeak = 12;
  for(let m=0; m<k; m++){
    let chosen = null;
    for(let tries=0; tries<triesPerPeak; tries++){
      const mu = lerp(marginL, marginR, Math.random());
      const ok = PARAMS.minSeparation <= 0
        || peaks.every(p => Math.abs(mu - p.mu) >= PARAMS.minSeparation)
        || Math.random() < 0.30; // 30% 概率无视间隔，打破"平均"
      if(ok){
        chosen = { mu,
          sigma: lerp(PARAMS.minSigma, PARAMS.maxSigma, Math.random()),
          w: 0.6 + Math.random(),
          seed: Math.random() * 10 };
        break;
      }
    }
    if(!chosen){ // 放宽限制兜底
      chosen = { mu: lerp(marginL, marginR, Math.random()),
        sigma: lerp(PARAMS.minSigma, PARAMS.maxSigma, Math.random()),
        w: 0.6 + Math.random(), seed: Math.random() * 10 };
    }
    peaks.push(chosen);
  }
  // 归一化权重
  const sumW = peaks.reduce((s,p)=>s+p.w, 0);
  for(const p of peaks) p.w /= sumW;

  return { y: H + 30, speed, amp, peaks, born: performance.now()/1000 };
}

let lines = [];
let running = true;

// HUD
const lcEl = document.getElementById('lc');
const spEl = document.getElementById('sp');
const tpEl = document.getElementById('tp');
const tlEl = document.getElementById('tl');
function updateHud(){
  if(lcEl) lcEl.textContent = `${lines.length}`;
  if(spEl) {
    if(lines.length){
      const avg = lines.reduce((s,p)=>s+p.speed,0)/lines.length;
      spEl.textContent = avg.toFixed(0);
    } else spEl.textContent = '-';
  }
  if(tpEl) tpEl.textContent = Math.round(PARAMS.topFlattenStart*100)+'%';
  if(tlEl) tlEl.textContent = PARAMS.tailLenBase.toFixed(0);
}

function seedLines(){
  lines = [];
  const n = Math.floor(lerp(PARAMS.minLines, PARAMS.maxLines + 1, Math.random()));
  for(let i=0;i<n;i++) lines.push(newLine());
  updateHud();
}
seedLines();

// 交互
window.addEventListener('keydown', (e)=>{
  if(e.code === 'Space'){ 
    running = !running; 
    // 同时控制音频的播放和暂停
    if(audioElement){
      if(audioContext && audioContext.state === 'suspended'){
        audioContext.resume();
      }
      if(running){
        audioElement.play().catch(e => console.error('音频播放失败:', e));
      } else {
        audioElement.pause();
      }
    }
  }
  else if(e.key === 'r' || e.key === 'R'){ seedLines(); }
  else if(e.key === 't' || e.key === 'T'){ PARAMS.useTrail = !PARAMS.useTrail; }
});
canvas.addEventListener('click', ()=>{ seedLines(); });

// —— 在给定 u（0..1）处求 y ——
function yAt(line, u, t, ampScale){
  let gsum = 0;
  for(const pk of line.peaks){
    const drift = Math.sin((t - line.born) * PARAMS.centerDriftSpeed * Math.PI * 2 + pk.seed) * PARAMS.centerDriftAmp;
    const mu = clamp(pk.mu + drift, 0.0, 1.0);
    gsum += pk.w * gauss(u, mu, pk.sigma);
  }
  const jitter = noise1(u, t, 7.7) * PARAMS.noiseAmp * ampScale;
  return line.y - (line.amp * ampScale * gsum) - jitter;
}

// 绘制单条"多峰"脉冲线 + 整条线垂直渐变拖尾 - 颜色渐变优化版
function drawLine(line, audioLevel){
  const t = performance.now()/1000;
  // 基于设备性能和屏幕尺寸智能调整点数量
  const pointDensity = window.innerWidth > 1200 ? 10 : window.innerWidth > 800 ? 8 : 5;
  const N = Math.max(60, Math.floor(W/pointDensity)); // 进一步减少点数量
  const step = W / (N-1);
  
  // 预计算主线 y 值
  const baseAmpScale = ampScaleForLine(line);
  // 根据音频电平调整幅度缩放
  const audioAmpScale = 1 + audioLevel * 0.5;
  const ampScale = baseAmpScale * audioAmpScale;
  
  // 性能优化：复用PARAMS中的原始固定颜色设置
  
  // 性能优化：使用预分配数组减少GC压力
  if (!drawLine.yValsBuffer || drawLine.yValsBuffer.length !== N) {
    drawLine.yValsBuffer = new Float32Array(N);
  }
  const yVals = drawLine.yValsBuffer;
  
  for(let i=0;i<N;i++){
    const u = (N===1?0:i/(N-1));
    // 在y值计算中应用音频影响
    let y = yAt(line, u, t, ampScale);
    
    // 额外添加与音频相关的波动 - 更精细的阈值控制
    if (audioLevel > 0.15) { 
      const audioInfluence = audioLevel * 8 * Math.sin(u * Math.PI * 2 + t * 2); // 更柔和的影响
      y -= audioInfluence;
    }
    
    yVals[i] = y;
  }
  
  // 根据设备性能和音频电平动态调整尾长度和层数
  const devicePixelRatio = window.devicePixelRatio || 1;
  const performanceFactor = devicePixelRatio > 1.5 ? 0.6 : 1.0; // 高分辨率屏幕进一步减少效果
  const tailAmpScale = 1 + audioLevel * 0.2; // 降低音频影响
  const tailLen = Math.min(PARAMS.tailLenBase * (0.35 + 0.65*ampScale) * tailAmpScale * performanceFactor, H);
  const maxLayersByLen = Math.max(1, Math.floor(tailLen / PARAMS.tailSpacing));
  const L = Math.min(Math.floor(PARAMS.tailLayersMax * 0.6), maxLayersByLen); // 进一步减少尾线层数

  // —— 先画尾巴（从近到远，alpha 由大到小，线宽渐变，颜色渐变）——
  if(L > 0 && tailLen > 0){
    ctx.save();
    ctx.shadowBlur = PARAMS.tailGlowBlur;
    
    // 绘制优化：批量绘制相邻、相似透明度的尾巴层
    let currentAlpha = -1;
    let currentWidth = -1;
    
    for(let k=1; k<=L; k++){
      const tRel = k / L; // 0..1
      const offset = k * (tailLen / L); // 让最远端刚好到达 tailLen
      const alpha = lerp(PARAMS.tailAlphaTop, PARAMS.tailAlphaBottom, tRel) * ampScale;
      if(alpha <= 0.002) continue;
      const width = PARAMS.lineWidth * lerp(PARAMS.tailWidthTopMul, PARAMS.tailWidthBottomMul, tRel);
      
      // 使用原始的固定尾线颜色
      const tailColor = PARAMS.tailColor;
      
      // 仅当状态变化时才重新设置上下文属性
      if (Math.abs(alpha - currentAlpha) > 0.01 || Math.abs(width - currentWidth) > 0.1) {
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        currentAlpha = alpha;
        currentWidth = width;
      }
      
      ctx.strokeStyle = tailColor;
      ctx.shadowColor = tailColor;
      
      ctx.beginPath();
      for(let i=0;i<N;i++){
        const x = i * step;
        const y = yVals[i] + offset;
        if(i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // —— 再画主线（使用原始固定颜色）——
  ctx.beginPath();
  for(let i=0;i<N;i++){
    const x = i * step;
    const y = yVals[i];
    if(i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.lineWidth = PARAMS.lineWidth;
  ctx.strokeStyle = PARAMS.strokeStyle;
  ctx.shadowColor = PARAMS.glowColor;
  ctx.shadowBlur = PARAMS.glowBlur;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// 性能优化：改进的数学计算缓存
const mathCacheSize = 1000; // 限制缓存大小
const mathCache = {
  sin: new Map(),
  exp: new Map()
};

// 缓存版本的sin函数
function cachedSin(x) {
  // 将值规范化到[-π, π]范围以减少缓存项
  const normX = ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const key = Math.round(normX * 1000) / 1000; // 降低精度要求
  
  if (mathCache.sin.has(key)) {
    return mathCache.sin.get(key);
  }
  
  const result = Math.sin(x);
  
  // 控制缓存大小
  if (mathCache.sin.size > mathCacheSize) {
    // 移除最早添加的项
    const firstKey = mathCache.sin.keys().next().value;
    mathCache.sin.delete(firstKey);
  }
  
  mathCache.sin.set(key, result);
  return result;
}

// 缓存版本的exp函数
function cachedExp(x) {
  const key = Math.round(x * 100) / 100; // 降低精度要求
  
  if (mathCache.exp.has(key)) {
    return mathCache.exp.get(key);
  }
  
  const result = Math.exp(x);
  
  // 控制缓存大小
  if (mathCache.exp.size > mathCacheSize) {
    // 移除最早添加的项
    const firstKey = mathCache.exp.keys().next().value;
    mathCache.exp.delete(firstKey);
  }
  
  mathCache.exp.set(key, result);
  return result;
}

// 主循环 - 优化版
let lastT = performance.now()/1000;
let lastFrameTime = 0;
const frameInterval = 1000 / PARAMS.throttleFPS; // 帧间隔时间（毫秒）

// 检测设备性能，调整参数
function detectPerformance() {
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const hasLowEndGPU = window.matchMedia('(max-width: 768px)').matches;
  
  if (isMobile || hasLowEndGPU) {
    // 降低低端设备的效果以提高性能
    PARAMS.maxLines = Math.min(4, PARAMS.maxLines);
    PARAMS.tailLayersMax = Math.min(12, PARAMS.tailLayersMax);
    PARAMS.throttleFPS = Math.min(45, PARAMS.throttleFPS);
  }
}

detectPerformance();

// 模拟音频数据（当实际音频不可用时）- 优化版
let simulationTime = 0;
let lastSimulatedAudioUpdate = 0;
let cachedSimulatedAudioLevel = 0;

function getSimulatedAudioLevel() {
  const now = performance.now();
  // 每5帧更新一次模拟音频数据，减少计算量
  if (now - lastSimulatedAudioUpdate > 80) { // 约12fps更新
    lastSimulatedAudioUpdate = now;
    simulationTime += 0.08; // 适当增加时间增量
    const base = Math.sin(simulationTime * 1.5) * 0.5 + 0.5; // 基础波动
    const beat = Math.sin(simulationTime * 0.2) * 0.3 + 0.7; // 节拍
    const noise = (Math.random() - 0.5) * 0.2; // 随机噪声
    cachedSimulatedAudioLevel = Math.max(0, Math.min(1, base * beat + noise));
  }
  
  return cachedSimulatedAudioLevel;
}

// 主循环 - 超级丝滑版
function tick(timestamp){
  // 帧率限制 - 使用时间插值提高平滑度
  if (PARAMS.throttleFPS > 0) {
    const elapsed = timestamp - lastFrameTime;
    if (elapsed < frameInterval) {
      requestAnimationFrame(tick);
      return;
    }
    // 考虑实际经过的时间，而不只是固定间隔
    lastFrameTime = timestamp;
  }

  const now = performance.now()/1000;
  const dt = Math.min(now - lastT, 0.1); // 限制最大时间步长，防止掉帧后跳跃
  lastT = now;

  if(running){
    // 背景 - 优化填充操作
    if(PARAMS.useTrail){
      ctx.fillStyle = `rgba(0,0,0,${PARAMS.fadeAlpha})`;
      ctx.fillRect(0,0,W,H);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0,0,W,H);
    }
    
    // 获取音频或模拟的音频电平
    let audioLevel = 0;
    if (PARAMS.audioVisualization && audioInitialized) {
      audioLevel = getAudioLevel();
    } else {
      // 如果没有真实音频，使用模拟的音频数据
      audioLevel = getSimulatedAudioLevel();
    }
    
    // 绘制小型音频可视化器 - 降低更新频率
    if (Math.floor(now * PARAMS.throttleFPS) % 2 === 0) {
      drawMiniVisualizer(audioLevel);
    }

    // 更新线条位置 - 合并循环减少遍历次数
    const visibleLines = [];
    for(const p of lines){ 
      // 根据音频电平调整线条速度 - 更平滑的过渡
      const speedFactor = 1 + audioLevel * 0.2; // 降低音频对速度的影响
      p.y -= p.speed * dt * speedFactor;
      
      // 同时过滤可见线条，避免二次遍历
      if (p.y < H + 50 && p.y >= -30) {
        visibleLines.push(p);
      }
    }
    
    // 绘制可见的线条
    for(const p of visibleLines) {
      drawLine(p, audioLevel);
    }

    // 移除到顶的线 - 利用过滤后的数组减少操作
    lines = visibleLines;

    // 随机补充线（保持 2–5，不强行平均）
    if(lines.length < PARAMS.minLines){
      lines.push(newLine());
    } else if(lines.length < PARAMS.maxLines && Math.random() < 0.03) {
      lines.push(newLine());
    }

    // 减少HUD更新频率，每4帧更新一次
    if(Math.floor(now * PARAMS.throttleFPS) % 4 === 0) {
      updateHud();
    }
  }

  // 使用requestAnimationFrame保持最佳性能
  requestAnimationFrame(tick);
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,W,H);
  
  // 初始化音频可视化
  if (PARAMS.audioVisualization) {
    initAudio();
  }
  
  // 初始化小型音频可视化器
  initMiniVisualizer();
  
  // 初始化天气数据
  updateBusanWeather();
  
  requestAnimationFrame(tick);
});