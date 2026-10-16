# TOP ·《童趣里的暴力》

[作品入口](index.html) · [创作与交互说明](prd.md)

当前实现使用 **8th Wall XR8** 图像识别与 Three.js，不是旧版 MindAR 实现。页面包含本地引擎回退和已经生成的目标 JSON，普通预览不需要重新编译识别图。

## 目录与资源

| 位置 | 用途 |
| --- | --- |
| `scripts/main.js` | AR、摄像头生命周期和 3D 展示 |
| `styles/` | `main.css` 引入基础主题、布局与相机层规则；`skin.css` 在其后覆盖入口页外观（主页同款黑底电光蓝、展签布局、相机层配色），不改相机层定位 |
| `scripts/popout.js` | 入口页的纸面倾斜与炸弹凸起效果；只写 `#sheet` 的 CSS 变量，不参与识别流程 |
| `assets/images/top-1.png` | 从画作中抠出的炸弹层，入口页用它做凸起效果（位置与 000-top.png 对齐：左 14.71%、上 52.81%、宽 23.92%） |
| `assets/images/` | 作品图、识别图和二维码 |
| `assets/targets/000-top/000-top.json` | 当前 XR8 识别目标 |
| `assets/targets/000-top.mind` | 历史 MindAR 目标，保留备用 |
| `assets/3d/` | GLB 模型、视频、GIF 与 PNG 叠加层 |
| `assets/xr/` | 本地 XR8 引擎及其随附许可证 |
| `scripts/i18n.js` | 中 / 英 / 韩文案 |
| `scripts/gen-target.mjs` | 重新生成 XR8 识别目标的开发工具 |
| `scripts/compile-mind-target.mjs` | 历史 MindAR 目标编译脚本，常规预览无需运行 |

当前复用仓库根目录 `neu/voice-three-control/vendor/three/` 中的 Three.js 和 GLTFLoader；仅引用这些模块，不修改 NEU 文件。请从仓库根目录启动静态服务器后访问 `/personal/works/top/`。

印刷二维码指向旧地址 `/web-media/inno-things/Top/`，仓库根目录的 `inno-things/Top/index.html` 负责跳转到这里，请勿删除。

## 更新识别目标

更换 `assets/images/000-top.png` 后，使用已有的 `@8thwall/image-target-cli` 安装生成新 JSON。工具会默认查找 `personal/node_modules/@8thwall/image-target-cli/src`，也可显式指定安装目录：

```powershell
$env:IMAGE_TARGET_CLI_SRC = 'D:/tools/node_modules/@8thwall/image-target-cli/src'
node personal/works/top/scripts/gen-target.mjs
```

输出写到 `assets/targets/000-top/`。生成工具依赖该 CLI 的内部 `apply.js`、`crop.js` 和其 `sharp` 依赖；缺少依赖时会给出路径提示。仓库不打包这些开发依赖。

## 修改后检查

通过 HTTPS 或 localhost 允许摄像头，使用同一张识别图检查首次识别、目标丢失恢复、模型和视频位置、横竖屏切换、退出相机后资源释放。浏览器页面检查不能替代手机相机实测。
