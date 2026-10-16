# 田汉 · 个人项目

个人主页与作品集中在这里；NEU 独立保留在仓库根目录的 `neu/`，本目录的整理不涉及它。

| 内容 | 入口 | 说明 |
| --- | --- | --- |
| 个人主页 · 中文 / English / 한국어 | [home/](home/index.html) | [home/README.md](home/README.md) |
| TOP ·《童趣里的暴力》图像识别 AR | [works/top/](works/top/index.html) | [运行与资源](works/top/README.md)、[创作说明](works/top/prd.md) |
| 山海 · 水墨与声音的网页作品 | [works/shanhai/](works/shanhai/index.html) | [说明](works/shanhai/README.md) |
| WebAR 方案对比（实验页，尚未接入 SDK） | [works/ar-compare/](works/ar-compare/index.html) | [说明](works/ar-compare/README.md) |
| 设计参考 · MongoDB / Vercel 样例 | [参考/](参考/README.md) | 第三方风格研究，不属于个人作品 |

```text
personal/
├── index.html     跳转到 home/
├── home/          个人主页：经历、论文、作品、出版、联系（唯一的简历内容来源）
├── works/
│   ├── top/         TOP AR 作品
│   ├── shanhai/     山海
│   └── ar-compare/  WebAR 方案对比实验
└── 参考/          设计参考
```

## 本地预览

从**仓库根目录**启动，TOP 需要访问 `neu/` 中的 Three.js 文件：

```sh
python -m http.server 8080 --bind 127.0.0.1
```

访问 <http://localhost:8080/personal/>。相机体验需要 HTTPS 或 localhost 以及摄像头权限。

## 维护约定

- 简历文字只改 `home/data.js`；作品新增到 `works/<名字>/`，并在 `home/data.js` 的 `links` 里加入口。
- 不要把尚未接 SDK 的实验页写成可用的 AR 演示。
- `neu/` 不纳入个人项目整理；TOP 只引用它的 Three.js 模块，不修改 NEU 文件。
- 仓库根目录的 `inno-things/Top/` 是给印刷二维码用的跳转页，指向 `works/top/`。
- 以前的 RPG 简历、资料页、山海旧稿与视觉实验、早期落地页资源已删除，需要时从 git 历史找回。
- 各项目授权以随附文件为准，个人目录不额外声明统一许可证。
