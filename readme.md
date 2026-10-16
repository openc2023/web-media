# Web Media

仓库分为两个独立区域：

| 目录 | 内容 | 入口 |
| --- | --- | --- |
| [personal/](personal/README.md) | 田汉的个人主页、资料、艺术作品、交互实验与设计参考 | [个人主页](personal/index.html) |
| neu/ | NEU 项目与相关资源 | [声音交互](neu/voice-three-control/index.html)、[Sound Ttakji](neu/sound-ttakji/index.html) |

根入口 `index.html` 跳转到个人主页。个人内容集中在 `personal/`，`neu/` 文件与访问路径保持原样。

```text
web-media/
├── personal/
│   ├── home/
│   ├── profile/
│   ├── inno-things/
│   ├── shanhaiart/
│   ├── shared/
│   ├── landing/
│   └── 参考/
├── neu/
├── index.html
└── readme.md
```

## 本地预览

在仓库根目录运行：

```sh
python -m http.server 8080 --bind 127.0.0.1
```

访问 <http://localhost:8080/> 或 <http://localhost:8080/personal/>。个人项目维护方式见 [personal/README.md](personal/README.md)。

个人项目原入口统一增加 `personal/` 前缀，例如 `home/` 改为 `personal/home/`。NEU 地址仍使用 `neu/`。
