# 田汉 · 个人项目集合

个人主页、学术资料与交互媒体作品的静态网站集合。使用 HTML、CSS 和 JavaScript，各项目保留独立入口。

## 页面入口

| 内容 | 本地入口 | 说明 |
| --- | --- | --- |
| 个人主页 | [home/](home/index.html) | RPG 风格简历，支持中、英、韩语言切换 |
| 个人资料 | [profile/](profile/index.html) | 经历、论文与项目详情，支持中、韩语言切换 |
| 交互实验 | [inno-things/](inno-things/index.html) | AR 作品、技术实验与设计预览的总入口 |
| TOP AR | [inno-things/Top/](inno-things/Top/index.html) | 《童趣里的暴力》图像识别 AR 作品 |
| WebAR 对比 | [inno-things/ar-compare/](inno-things/ar-compare/index.html) | MindAR、8th Wall 与 Zappar 路线实验 |
| 山海 | [shanhaiart/](shanhaiart/index.html) | 新媒体艺术与视觉交互作品 |

线上从 [个人主页](https://openc2023.github.io/web-media/personal/) 进入。

## 目录与维护位置

```text
index.html       网站入口，跳转到 home/
home/            RPG 主页，以及个人资料页复用的数据、样式和渲染模块
profile/         个人资料页入口
inno-things/     交互媒体实验与 AR 项目
shanhaiart/      山海作品；old/ 为历史版本，test/ 为视觉实验
shared/          公共主题与图像识别目标编译脚本
landing/         早期落地页样式与交互资源，保留备用
参考/            设计参考与主题预览
```

- 修改 RPG 简历：查看 [home/README.md](home/README.md)。
- 修改个人资料文字：编辑 `home/data/locales/zh.js` 和 `ko.js`；媒体路径在 `home/data/shared/media.js`。
- 修改 AR 作品：查看 [TOP 项目说明](inno-things/Top/prd.md) 与 [AR 对比说明](inno-things/ar-compare/README.md)。
- 修改山海作品：查看 [山海说明](shanhaiart/readme.md)。
- 复用公共主题：查看 [shared/README.md](shared/README.md)。修改前检查引用，避免影响其他项目。
- 历史稿、实验页与参考素材保留原路径；新增作品优先放入对应分类，并更新本表和页面导航。

## 本地预览

在 personal/ 目录启动静态服务器，无需构建：

```sh
python -m http.server 8080 --bind 127.0.0.1
```

打开 <http://localhost:8080/>。也可以使用已有的静态服务器。个人资料页使用 ES modules，请通过 HTTP 访问。

AR 相机体验需要 HTTPS 或 localhost，以及浏览器摄像头权限。手机通过局域网 IP 打开普通 HTTP 服务时，摄像头可能不可用；各 AR 方案的配置要求以子项目说明为准。

## 整理约定

保留已有访问地址，不为分类而移动作品素材。`../neu/` 保持独立；公共资源变更也应检查它的引用。根目录不声明统一许可证，各项目的授权以其随附文件为准。
