# 田汉 · 个人项目

这里集中维护个人主页、简历、艺术作品和交互实验。每个项目的页面、脚本、样式和素材优先放在自己的目录；NEU 独立保留在仓库根目录的 `neu/`。

## 项目目录

| 分类 | 内容 | 页面 | 维护说明 |
| --- | --- | --- | --- |
| 个人展示 | RPG 个人主页 · 中文 / English / 한국어 | [进入主页](home/index.html) | [home/README.md](home/README.md) |
| 个人展示 | 个人资料、经历、论文和项目 · 中文 / 한국어 | [查看资料](profile/index.html) | [profile/README.md](profile/README.md) |
| 艺术作品 | 山海 | [进入作品](shanhaiart/index.html) | [作品说明](shanhaiart/readme.md) |
| 艺术作品 | TOP ·《童趣里的暴力》图像识别 AR | [进入作品](inno-things/Top/index.html) | [运行与资源](inno-things/Top/README.md)、[创作说明](inno-things/Top/prd.md) |
| 技术实验 | AR 方案对比，实验页尚未接入 SDK | [查看实验](inno-things/ar-compare/index.html) | [实验说明](inno-things/ar-compare/README.md) |
| 设计参考 | MongoDB / Vercel 明暗主题样例 | [参考目录](参考/README.md) | 保留原始来源说明 |
| 历史归档 | 早期落地页资源、山海旧稿与视觉测试 | [归档目录](archive/README.md) | 保留素材和历史版本 |

交互作品总入口：[Inno Things](inno-things/index.html)。

## 目录分工

```text
personal/
├── home/          RPG 主页：index.html、style.css、js/
├── profile/       资料页：assets/、data/、scripts/、styles/
├── inno-things/   TOP 作品与 AR 对比实验
├── shanhaiart/    山海作品，old/ 和 test/ 保留历史版本
├── shared/        公共样式与历史识别目标编译工具
├── 参考/          MongoDB、Vercel 设计参考
├── archive/       早期资源及历史内容索引
└── index.html     跳转到 RPG 主页
```

## 本地预览

从**仓库根目录**启动，保证个人项目仍能访问其复用的 NEU Three.js 文件：

```sh
python -m http.server 8080 --bind 127.0.0.1
```

访问 <http://localhost:8080/personal/>。资料页通过 ES modules 渲染，使用 HTTP 预览。相机体验需要 HTTPS 或 localhost 以及摄像头权限。

## 维护约定

- 当前作品和未完成实验分别标明状态；不要把尚未接 SDK 的页面写成可用 AR 演示。
- 修改资料文案时同步 `profile/data/locales/zh.js` 和 `ko.js`；RPG 主页的三语内容在 `home/js/app.js`。
- 占位照片与项目缩略图在 `profile/assets/placeholders/`，替换真实素材时更新 `profile/data/shared/media.js`。
- 设计参考只放在 `参考/`；个人项目的通用样式见 [shared/README.md](shared/README.md)。
- 历史页面、重复音频和图片暂保留，各历史版本仍可独立查看；重复项记录在 [归档说明](archive/README.md)。
- `neu/` 不纳入个人项目整理；TOP 当前复用它的 Three.js 模块，依赖路径见 TOP 的 README。
- 各项目授权以随附文件为准，个人目录不额外声明统一许可证。

本轮路径变化：资料页资源由 `home/` 移入 `profile/`；`inno-things/vercel/` 移入 `参考/vercel/`；早期 `landing/` 资源归入 `archive/landing/`。页面入口 `home/`、`profile/`、`inno-things/Top/` 和 `shanhaiart/` 保持本轮迁移后的地址。
