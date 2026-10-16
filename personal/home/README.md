# 个人主页与资料页

本目录包含两套独立页面使用的资源，维护时按实际入口区分。

| 页面 | 入口 | 内容与交互 | 样式 |
| --- | --- | --- | --- |
| RPG 个人主页 | `home/index.html` | `js/app.js`；背景、声音与头像分别在 `js/bg.js`、`js/audio.js`、`js/avatar.js` | `style.css` |
| 个人资料页 | `profile/index.html` | `scripts/main.js`、`scripts/render/`、`data/locales/` | `styles/base/`、`styles/components/`、`styles/pages/` |

## 修改文字与媒体

- RPG 主页的中、英、韩文案在 `js/app.js`，初始静态文案在 `index.html`。
- 个人资料页的中文与韩文分别在 `data/locales/zh.js` 和 `ko.js`；修改时同步字段结构。
- 个人资料页的媒体映射在 `data/shared/media.js`，本地 SVG 占位图在 `assets/placeholders/`。替换时保留文件名，或同步更新映射。
- `profile/index.html` 使用 `<base href="../">`，其资源和数据链接均相对于personal/ 目录，例如 `home/assets/...`。
- `scripts/content.js`、`scripts/render.js` 与 `styles/home.css`、`styles/theme.css` 为现有兼容入口，保留原路径。

## 导航与验证

RPG 主页可进入个人资料、交互实验与山海；个人资料的导航可返回 RPG 主页。根目录 `index.html` 继续跳转到 RPG 主页。

在personal/ 目录启动静态服务器，分别访问 `/home/` 和 `/profile/`。检查语言切换、页面导航、移动端排版；RPG 主页还应检查开始界面与存档交互。
