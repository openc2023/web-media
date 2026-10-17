import * as THREE from "three";
import { CONFIG } from "../config.js";

/**
 * 字符夜空：画在一张 2D 画布上，作为场景背景贴图。
 * 颜色用 NEU 品牌渐变（青绿 → 珊瑚橙），平时很淡；出声时从风车附近泛起一圈圈字符波纹，越响越亮、越快。
 */
const RAMP = " .·:-~=+*";
const NOTES = ["♪", "♫"];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function createAsciiSky() {
  const look = CONFIG.look;
  const ascii = look.ascii;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const from = hexToRgb(ascii.colors[0]);
  const to = hexToRgb(ascii.colors[1]);
  const BUCKETS = 8;
  const bucketColor = [];
  for (let b = 0; b < BUCKETS; b++) {
    const k = b / (BUCKETS - 1);
    bucketColor.push(`rgb(${Math.round(from[0] + (to[0] - from[0]) * k)}, ${Math.round(from[1] + (to[1] - from[1]) * k)}, ${Math.round(from[2] + (to[2] - from[2]) * k)})`);
  }

  let W = 0, H = 0, cw = 6, ch = 10, cols = 0, rows = 0;
  let level = 0;          // 平滑后的音量
  let phase = 0;          // 波纹相位，音量越大走得越快
  let sinceDraw = 1;

  function resize() {
    // 画布按窗口的一部分分辨率绘制，背景本来就很淡，省下贴图上传的开销
    const scale = window.innerWidth < 720 ? 0.6 : 0.5;
    W = Math.max(240, Math.round(window.innerWidth * scale));
    H = Math.max(240, Math.round(window.innerHeight * scale));
    canvas.width = W;
    canvas.height = H;
    const fs = window.innerWidth < 720 ? 8 : 7;
    cw = fs * 0.62;
    ch = fs * 1.25;
    cols = Math.ceil(W / cw);
    rows = Math.ceil(H / ch);
    ctx.font = `${fs}px "SFMono-Regular", Menlo, Consolas, monospace`;
    ctx.textBaseline = "top";
    sinceDraw = 1;
  }

  function hash(x, y) {
    const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }

  function draw(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, look.sky[0]);
    g.addColorStop(0.55, look.sky[1]);
    g.addColorStop(1, look.sky[2]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const cx = cols * 0.5, cy = rows * ascii.centerY;
    const buckets = Array.from({ length: BUCKETS }, () => []);
    const last = RAMP.length - 1;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const dx = (x - cx) * (cw / ch), dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // 平时：缓慢漂移的稀疏星点；出声：同心波纹
        const drift = Math.sin(x * 0.21 + t * 0.3) * Math.cos(y * 0.27 - t * 0.2);
        let v = Math.max(0, drift) * 0.42 * (0.6 + hash(x, y) * 0.8);
        const ring = Math.sin(dist * 0.42 - phase);
        v += Math.pow(Math.max(0, ring), 3) * level * 1.3 * Math.max(0, 1 - dist / (rows * 1.1));
        v += level * 0.12;
        if (v < 0.08) continue;
        const k = Math.min(BUCKETS - 1, Math.floor(((x / cols) * 0.8 + (y / rows) * 0.2) * BUCKETS));
        buckets[k].push(x, y, Math.min(1, v));
      }
    }
    for (let b = 0; b < BUCKETS; b++) {
      const list = buckets[b];
      if (!list.length) continue;
      ctx.fillStyle = bucketColor[b];
      for (let i = 0; i < list.length; i += 3) {
        const x = list[i], y = list[i + 1], v = list[i + 2];
        ctx.globalAlpha = Math.min(ascii.maxAlpha, ascii.baseAlpha + v * (ascii.maxAlpha - ascii.baseAlpha));
        const loud = level > 0.35 && v > 0.6 && hash(x + Math.floor(t * 2), y) > 0.993;
        ctx.fillText(loud ? NOTES[(x + y) & 1] : RAMP.charAt(Math.max(1, Math.round(v * last))), x * cw, y * ch);
      }
    }
    ctx.globalAlpha = 1;
    texture.needsUpdate = true;
  }

  function update(dt, t, state) {
    const target = Math.min(1, Math.max(state?.energy || 0, (state?.instantEnergy || 0) * 0.8) * ascii.gain);
    level += (target - level) * Math.min(1, dt * 4);
    phase += dt * (1.1 + level * 6);
    sinceDraw += dt;
    // 约 20 帧每秒重画一次就够了
    if (sinceDraw >= 1 / 20) {
      sinceDraw = 0;
      draw(t);
    }
  }

  resize();
  draw(0);
  return { texture, update, resize };
}
