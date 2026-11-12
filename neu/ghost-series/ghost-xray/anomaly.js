// 异常剧情（鬼神系列 04）：每个被追踪的人独立走一遍
//   calm 平静  → 正常 X 光，体征正常
//   wrong 异常 → 体征越来越不对：心跳变慢、乱跳，体温往下掉，卡片转红
//   reveal 显形 → 无生命体征；眼眶变黑洞、头骨裂开、肩后多出一只不属于任何人的手骨
//   drop 断讯  → 这个人的画面 SIGNAL LOST，随后回到平静，再来一轮
// 每轮各阶段时长随机拉长/缩短（anVary），裂痕、手的位置每轮重新随机。
export const PHASES = ['calm', 'wrong', 'reveal', 'drop'];
const DUR_KEY = { calm: 'anCalm', wrong: 'anWrong', reveal: 'anReveal', drop: 'anDrop' };
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function newRound(S) {
  const mul = {}; for (const p of PHASES) mul[p] = 1 + rnd(-1, 1) * S.anVary;
  return { ph: 'calm', t: 0, k: 0, mul, side: Math.random() < 0.5 ? -1 : 1, cracks: makeCracks(), seed: Math.random() * 100, at: 0 };
}
export const durOf = (S, a, ph) => Math.max(0.3, S[DUR_KEY[ph]] * a.mul[ph]);

// 推进一个人的剧情；返回刚进入的阶段名（没切换时返回 null）
export function stepAnomaly(S, head, now) {
  if (!S.anOn) { head.anom = null; return null; }
  let a = head.anom;
  if (!a) { a = head.anom = newRound(S); a.at = now; return 'calm'; }
  const dt = clamp((now - a.at) / 1000, 0, 0.2); a.at = now; a.t += dt;
  let entered = null;
  while (a.t >= durOf(S, a, a.ph)) {
    a.t -= durOf(S, a, a.ph);
    const i = PHASES.indexOf(a.ph);
    if (i === PHASES.length - 1) { const r = newRound(S); Object.assign(a, r, { at: now }); entered = 'calm'; break; }
    a.ph = PHASES[i + 1]; entered = a.ph;
  }
  a.k = clamp(a.t / durOf(S, a, a.ph), 0, 1);
  return entered;
}
// 0（正常）→ 1（完全异常）：异常阶段里慢慢涨，显形/断讯时一直是 1
export const wrongness = a => !a ? 0 : a.ph === 'calm' ? 0 : a.ph === 'wrong' ? a.k : 1;
// 显形程度：显形阶段前 35% 慢慢长出来
export const revealK = a => !a ? 0 : a.ph === 'reveal' ? clamp(a.k / 0.35, 0, 1) : a.ph === 'drop' ? 1 : 0;

// 裂痕：脸部局部坐标（u：左右，-1..1 是两颊；v：0 是额顶，向下为负），每轮随机
function makeCracks() {
  const out = [], n = 3 + (Math.random() * 3 | 0);
  const walk = (u, v, ang, len, depth) => {
    const pts = [[u, v]]; let total = 0;
    for (let i = 0; i < 7 && total < len; i++) {
      ang += rnd(-0.7, 0.7); const s = rnd(0.05, 0.11); u += Math.cos(ang) * s; v += Math.sin(ang) * s; total += s; pts.push([u, v]);
      if (depth < 2 && Math.random() < 0.35) walk(u, v, ang + rnd(-1.3, 1.3), len * 0.45, depth + 1);
    }
    out.push({ pts, len: total, depth });
  };
  const u0 = rnd(-0.35, 0.35), v0 = rnd(-0.32, -0.12);
  for (let i = 0; i < n; i++) walk(u0, v0, (i / n) * Math.PI * 2 + rnd(-0.4, 0.4), rnd(0.35, 0.6), 0);
  return out;
}

// 2D 叠加（画在 hud 上）：黑眼洞 + 黑泪痕、裂痕、断讯雪花
export function drawAnomaly(g, actor, now, S, W, H, screenX) {
  const h = actor.head, a = h.anom, l = h.lms; if (!a || !l) return;
  const P = i => l[i] ? { x: screenX(l[i].x), y: l[i].y * H } : null;
  const rk = revealK(a), drop = a.ph === 'drop';
  g.save(); g.globalAlpha = h.opacity;
  if (drop) { drawStatic(g, h, now, W, H, screenX, a, S); g.restore(); return; }
  // 裂痕：沿额头往外长，跟着头的方向
  const top = P(10), chin = P(152), cl = P(234), cr = P(454);
  if (S.anCracks && rk > 0 && top && chin && cl && cr) {
    const R = { x: (cr.x - cl.x) / 2, y: (cr.y - cl.y) / 2 }, U = { x: (top.x - chin.x) / 2, y: (top.y - chin.y) / 2 };
    const at = (u, v) => [top.x + R.x * u + U.x * v, top.y + R.y * u + U.y * v];
    const grow = rk;
    g.lineJoin = g.lineCap = 'round'; g.shadowColor = 'rgba(255,40,30,.9)'; g.shadowBlur = 6;
    for (const c of a.cracks) {
      let left = c.len * clamp(grow * 1.4 - c.depth * 0.3, 0, 1); if (left <= 0) continue;
      g.strokeStyle = c.depth ? 'rgba(255,214,196,.6)' : 'rgba(255,236,220,.9)'; g.lineWidth = c.depth ? 0.9 : 1.6;
      g.beginPath(); g.moveTo(...at(...c.pts[0]));
      for (let i = 1; i < c.pts.length && left > 0; i++) {
        const [u0, v0] = c.pts[i - 1], [u1, v1] = c.pts[i], s = Math.hypot(u1 - u0, v1 - v0), f = Math.min(1, left / s);
        g.lineTo(...at(u0 + (u1 - u0) * f, v0 + (v1 - v0) * f)); left -= s;
      }
      g.stroke();
    }
    g.shadowBlur = 0;
  }
  // 黑眼洞：眼角关键点 33/133、263/362 定位，慢慢变黑，然后往下流黑泪
  if (S.anEyes && rk > 0) for (const [o, i] of [[33, 133], [263, 362]]) {
    const A = P(o), B = P(i); if (!A || !B) continue;
    const cx = (A.x + B.x) / 2, cy = (A.y + B.y) / 2, r = Math.hypot(A.x - B.x, A.y - B.y) * 0.62 * (0.6 + 0.4 * rk);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.55);
    gr.addColorStop(0, `rgba(0,0,0,${0.97 * rk})`); gr.addColorStop(0.55, `rgba(0,0,0,${0.9 * rk})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r * 1.55, 0, 6.3); g.fill();
    const tear = clamp((a.ph === 'reveal' ? a.k : 1) * 1.6 - 0.35, 0, 1);
    if (tear > 0) {
      const len = r * 4.2 * tear, lg = g.createLinearGradient(cx, cy, cx, cy + len);
      lg.addColorStop(0, 'rgba(0,0,0,.85)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.strokeStyle = lg; g.lineWidth = Math.max(1.5, r * 0.22);
      g.beginPath(); g.moveTo(cx - r * 0.25, cy + r * 0.4); g.quadraticCurveTo(cx - r * 0.32, cy + len * 0.5, cx - r * 0.2, cy + len); g.stroke();
    }
    // 眼洞里一点红光，偶尔闪
    if (Math.sin(now / 170 + a.seed + o) > -0.6) { g.fillStyle = `rgba(255,45,35,${0.85 * rk})`; g.beginPath(); g.arc(cx + r * 0.12, cy - r * 0.1, Math.max(1, r * 0.09), 0, 6.3); g.fill(); }
  }
  g.restore();
}

// 断讯：这个人的头部区域变成雪花 + SIGNAL LOST
function drawStatic(g, h, now, W, H, screenX, a, S) {
  const b = h.box; if (!b) return;
  // 以头为中心，至少 200px 宽，放得下 “SUBJ 01 · SIGNAL LOST”
  const w = Math.max(200, b.w * W * 1.5), hh = Math.max(120, b.h * H * 1.7);
  const cx = screenX(b.left + b.w / 2), cy = (b.top + b.h / 2) * H, x = cx - w / 2, y = cy - hh / 2;
  const fade = a.k < 0.15 ? a.k / 0.15 : a.k > 0.85 ? (1 - a.k) / 0.15 : 1;
  g.globalAlpha *= clamp(fade, 0, 1);
  g.fillStyle = 'rgba(10,10,10,.82)'; g.fillRect(x, y, w, hh);
  for (let i = 0; i < 260; i++) { const v = Math.random() * 200 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + Math.random() * w, y + Math.random() * hh, rnd(1, 4), 1); }
  g.fillStyle = 'rgba(255,255,255,.08)'; for (let yy = y; yy < y + hh; yy += 3) g.fillRect(x, yy, w, 1);
  g.font = 'bold 13px Consolas,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = (now / 400 | 0) % 2 ? '#e5484d' : '#f4f4f5';
  g.fillText(`SUBJ ${String(h.id + 1).padStart(2, '0')} · SIGNAL LOST`, x + w / 2, y + hh / 2);
  g.textAlign = 'left';
}

// 肩后的手骨：用数据集自带的手（21 点），放在头框旁边偏下，从下面慢慢伸上来，手指轻轻抽动
export function ghostHandPoints(head, base) {
  const a = head.anom, b = head.box; if (!a || !b || !base) return null;
  const rk = revealK(a); if (rk <= 0 || a.ph === 'drop') return null;
  let lo = [1e9, 1e9], hi = [-1e9, -1e9];
  for (const p of base) { lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[2])]; hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[2])]; }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1]) || 1, k = b.w * 1.15 / span, c = base[9];
  const cx = b.left + b.w / 2 + a.side * b.w * 0.95, cy = b.top + b.h * (1.25 + 0.55 * (1 - rk));
  const t = performance.now() / 1000;
  return base.map((p, i) => ({
    x: cx - a.side * (p[0] - c[0]) * k + Math.sin(t * 3 + i) * 0.0015 * (i % 4),
    y: cy + (p[2] - c[2]) * k * (16 / 9) + Math.cos(t * 2.3 + i * 0.7) * 0.002 * (i % 4),
    z: (p[1] - c[1]) * k,
  }));
}

// ---------- 声音：心跳（跟着模拟心率变慢、乱跳）→ 平直的长鸣 → 断讯静电 ----------
let ac = null, master = null, flat = null, nextBeat = 0;
export function initAudio(S) {
  if (ac) { ac.resume?.(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = S.anVolume; master.connect(ac.destination); } catch { ac = null; }
}
function thump(vol) {
  const t = ac.currentTime;
  for (const [dt, f] of [[0, 62], [0.16, 54]]) {
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(f, t + dt); o.frequency.exponentialRampToValueAtTime(34, t + dt + 0.14);
    g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(vol, t + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.18);
    o.connect(g); g.connect(master); o.start(t + dt); o.stop(t + dt + 0.2);
  }
}
export function staticBurst(dur = 0.6) {
  if (!ac) return; const n = Math.ceil(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = buf; f.type = 'bandpass'; f.frequency.value = 2400;
  g.gain.setValueAtTime(0.25, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
// 每帧调用一次：拿剧情走得最远的那个人来出声，几个人同时也不会吵成一团
export function updateSound(S, actors, now) {
  if (!ac) return;
  master.gain.setTargetAtTime(S.anOn ? S.anVolume : 0, ac.currentTime, 0.05);
  const order = PHASES, lead = actors.filter(x => x.head.anom).sort((p, q) => order.indexOf(q.head.anom.ph) - order.indexOf(p.head.anom.ph))[0];
  const a = lead?.head.anom, w = wrongness(a), dead = a && (a.ph === 'reveal');
  if (a && !dead && a.ph !== 'drop' && now >= nextBeat) {
    const hr = (lead.head.vitals?.shown || 72), irregular = w > 0.35 && Math.random() < w * 0.5;
    thump(0.35 + 0.35 * w); nextBeat = now + 60000 / Math.max(18, hr) * (irregular ? rnd(0.4, 1.8) : 1);
  }
  if (dead && !flat) {
    flat = { o: ac.createOscillator(), g: ac.createGain() }; flat.o.frequency.value = 980; flat.o.type = 'sine';
    flat.g.gain.value = 0.0001; flat.g.gain.setTargetAtTime(0.05, ac.currentTime, 0.3); flat.o.connect(flat.g); flat.g.connect(master); flat.o.start();
  } else if (!dead && flat) { const f = flat; flat = null; f.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.05); f.o.stop(ac.currentTime + 0.3); }
}
