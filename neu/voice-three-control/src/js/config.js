/**
 * 项目配置 — 换新项目只改这里
 */
export const CONFIG = {
  // ── 模型路径 ──────────────────────────────
  models: {
    /** 背景场景（静止） */
    background: new URL("../../assets/models/mogu.glb", import.meta.url).href,
    /** 动画主模型 */
    animated: new URL("../../assets/models/fengche.glb", import.meta.url).href,
    /** 动画主模型中的翅膀网格名称 */
    bladeMeshName: "2",
  },

  // ── 场景外观 ──────────────────────────────
  scene: {
    background: 0x000000,
    fog: { color: 0x05060f, near: 55, far: 220 },
    /** 模型缩放目标尺寸（Three.js 单位） */
    targetSize: 14,
  },

  // ── 画面质感 ──────────────────────────────
  look: {
    /** 背景渐变：顶部 / 中段 / 底部 */
    sky: ["#11143a", "#07081a", "#020205"],
    /** 泛光：只有足够亮的地方（萤火虫、发光蘑菇）才会发光 */
    bloom: { strength: 0.55, radius: 0.55, threshold: 0.78 },
    /** 暗角强度、饱和度（1 = 原样） */
    vignette: 0.42,
    saturation: 1.06,
    /** 不操作时镜头环绕速度（OrbitControls autoRotateSpeed） */
    idleRotateSpeed: 0.35,
  },

  // ── 灯光 ─────────────────────────────────
  lights: {
    ambient:  { color: 0xffffff, intensity: 1.8 },
    key:      { color: 0xfff1d2, intensity: 2.8, position: [7, 10, 6] },
    fill:     { color: 0x9fe9d8, intensity: 1.5, position: [-6, 4, 5] },
    rim:      { color: 0xff8d69, intensity: 18,  position: [6, 5, -5], distance: 80 },
  },

  // ── 动画播放速度 ──────────────────────────
  playback: {
    attack:         0.045,  // 声音变大时加速响应
    release:        0.022,  // 声音变小时减速响应
    pauseThreshold: 0.003,  // 低于此速度暂停动画
    minActiveSpeed: 0.01,
  },

  // ── 翅膀变色面板 ──────────────────────────
  blade: {
    /** 声音触发变色的 energy 阈值 */
    activeThreshold: 0.015,
    /** 随机换色的颜色池 */
    palette: [
      0x42e8ff,
      0x7b61ff,
      0xff4fd8,
      0x7dff7a,
      0xffb347,
    ],
  },
};
