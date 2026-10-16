# 山海 · 新媒体艺术交互项目

以山海意象、动态视觉与声音为主题的 Web 艺术作品，使用 HTML、CSS、JavaScript 与 Canvas。

## 入口

- [作品介绍](index.html)
- [当前作品](shanhai/shanhai.html)
- [个人主页](../home/index.html)

## 目录

```text
shanhaiart/
├── index.html           作品介绍与导航
├── shanhai/             当前作品、音频与图片
│   └── shanhai.html     当前作品入口
├── old/                 历史版本及其资源
├── test/                水墨、海水、波浪与音乐等视觉实验
└── readme.md            本说明
```

历史版本与实验保留原路径，便于回看，不作为默认作品入口。

## 本地运行

从 personal/ 目录运行：

```sh
python -m http.server 8080 --bind 127.0.0.1
```

访问 <http://localhost:8080/shanhaiart/>。音频播放可能需要先点击页面；具体交互以各作品页面为准。
