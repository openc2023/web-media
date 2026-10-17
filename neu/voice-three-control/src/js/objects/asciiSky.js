import * as THREE from "three";
import { CONFIG } from "../config.js";

/**
 * 字符夜空：画在一张 2D 画布上，作为场景背景贴图。
 * 颜色用 NEU 品牌渐变（青绿 → 珊瑚橙），图案是不规则流动的液体纹理；平时很淡、流得慢，出声时流得更快、翻涌更强、更亮。
 * 液体较浓处零星浮现「NEU」字样。
 */
const RAMP = " .·:-~=+*";
const NOTES = ["♪", "♫"];
const WORD = "NEU";
const GLITCH = "NEU#%/<>=+*";

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
    const c = [0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * k);
    const l = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    const m = ascii.muted;   // 0 = 原色，1 = 全灰
    bucketColor.push(`rgb(${c.map((v) => Math.round(v + (l - v) * m)).join(", ")})`);
  }

  let W = 0, H = 0, cw = 6, ch = 10, cols = 0, rows = 0;
  let level = 0;          // 平滑后的音量
  let phase = 0;          // 液体流动的时间轴，音量越大走得越快
  let sinceDraw = 1;

  function resize() {
    // 画布按窗口的一部分分辨率绘制，背景本来就很淡，省下贴图上传的开销
    const scale = window.innerWidth < 720 ? 0.6 : 0.5;
    W = Math.max(240, Math.round(window.innerWidth * scale));
    H = Math.max(240, Math.round(window.innerHeight * scale));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      texture.dispose();
    }
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
  function vnoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y) {
    return vnoise(x, y) * 0.55 + vnoise(x * 2.03 + 3.1, y * 2.03 - 1.7) * 0.3 + vnoise(x * 4.1 - 2.3, y * 4.1 + 4.4) * 0.15;
  }

  function draw(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, look.sky[0]);
    g.addColorStop(0.55, look.sky[1]);
    g.addColorStop(1, look.sky[2]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const buckets = Array.from({ length: BUCKETS }, () => []);
    const last = RAMP.length - 1;
    const vgrid = new Float32Array(cols * rows);
    const kgrid = new Uint8Array(cols * rows);
    const aspect = cw / ch;
    // 不规则液体：两层扭曲的噪声场，像墨在水里慢慢流淌；音量越大流得越快、翻涌越强
    const swirl = 1.2 + level * 2.6;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = x * aspect * 0.055, py = y * 0.055;
        const qx = fbm(px + phase * 0.11, py - phase * 0.07);
        const qy = fbm(px - phase * 0.06 + 5.2, py + phase * 0.09 + 1.3);
        const f = fbm(px + qx * swirl, py + qy * swirl - phase * 0.05);
        // 只取浓的一段，留出大片空隙，形成一条条流动的“液带”
        let v = (f - 0.52 + level * 0.12) * (2.4 + level * 1.6);
        if (v < 0.08) continue;
        v = Math.min(1, v);
        // 颜色也随液体混合：第二层噪声决定偏青绿还是偏橙
        const warm = Math.max(0, (qy - 0.55) * 2.2) * (0.35 + v * 0.65) + level * 0.35;
        const k = Math.min(BUCKETS - 1, Math.max(0, Math.floor(warm * BUCKETS)));
        vgrid[y * cols + x] = v;
        kgrid[y * cols + x] = k;
      }
    }

    // 液体较浓的地方零星浮现「NEU」：先乱码，再收成 NEU，然后淡出；声音大时出现得更频繁
    const words = [];
    const skip = new Uint8Array(cols * rows);
    const chance = ascii.wordChance + level * 0.008;
    for (let y = 0; y < rows; y++) {
      for (let wc = 0; wc + 2 < cols; wc += 3) {
        const i0 = y * cols + wc;
        if (vgrid[i0 + 1] < 0.3) continue;
        const seed = hash(wc * 0.31, y * 0.57);
        const life = t / 4.5 + seed * 9;
        const gen = Math.floor(life);
        if (hash(wc * 1.7 + gen * 5.3, y * 2.9) > chance) continue;
        const ph = life - gen;
        words.push(wc, y, ph, kgrid[i0 + 1]);
        skip[i0] = skip[i0 + 1] = skip[i0 + 2] = 1;
      }
    }
    for (let i = 0; i < vgrid.length; i++) {
      if (vgrid[i] === 0 || skip[i]) continue;
      buckets[kgrid[i]].push(i % cols, Math.floor(i / cols), vgrid[i]);
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
    for (let i = 0; i < words.length; i += 4) {
      const wx = words[i], wy = words[i + 1], ph = words[i + 2];
      ctx.fillStyle = bucketColor[Math.min(BUCKETS - 1, words[i + 3] + 1)];
      ctx.globalAlpha = Math.min(0.85, Math.sin(ph * Math.PI) * (ascii.maxAlpha + 0.18));
      for (let w = 0; w < 3; w++) {
        const settled = ph > 0.18 + w * 0.06;
        const c = settled ? WORD.charAt(w) : GLITCH.charAt(Math.floor(hash(wx + w, wy + Math.floor(t * 12)) * GLITCH.length));
        ctx.fillText(c, (wx + w) * cw, wy * ch);
      }
    }
    ctx.globalAlpha = 1;
    texture.needsUpdate = true;
  }

  function update(dt, t, state) {
    const target = Math.min(1, Math.max(state?.energy || 0, (state?.instantEnergy || 0) * 0.8) * ascii.gain);
    level += (target - level) * Math.min(1, dt * 4);
    phase += dt * (0.6 + level * 4);
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
