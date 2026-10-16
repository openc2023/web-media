# 个人资料页

入口：[index.html](index.html)。展示个人经历、论文、项目和联系方式，支持中文与韩文。

| 目录 / 文件 | 用途 |
| --- | --- |
| `data/locales/zh.js`、`ko.js` | 两种语言的文案与导航 |
| `data/shared/media.js` | 图片路径映射 |
| `assets/placeholders/` | 待替换的照片与项目缩略图 |
| `scripts/main.js` | 页面挂载、语言切换与页内导航 |
| `scripts/render/` | 页面及分区模板 |
| `styles/base/` | 主题与基础样式 |
| `styles/components/` | 媒体和卡片组件 |
| `styles/pages/` | 页面布局 |

`index.html` 使用 `<base href="../">`，资源及数据中的相对 URL 以 `personal/` 为基准，例如 `profile/assets/...`。页内链接由 `scripts/main.js` 绑定到资料页自身。

`scripts/content.js`、`scripts/render.js` 及 `styles/home.css`、`styles/theme.css` 是兼容导出或聚合入口，保留备用。

从仓库根目录启动静态服务器，访问 `/personal/profile/`。修改后检查两种语言、页内锚点、图片与返回主页导航。

内容待核实：此页与 RPG 主页的邮箱拼写不同，暂未替用户判断正确地址。照片和部分项目图片仍为明确标记的占位素材。
