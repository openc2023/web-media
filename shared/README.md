# Shared Theme

`web-media/shared/styles/theme-mongo-cream.css` 是当前公共主题入口。

适合复用的内容:
- 米白主底 + 深绿重点色 token
- 基础排版
- 通用按钮
- 通用卡片 / 面板样式
- 标签和顶部品牌胶囊

推荐用法:

```css
@import url("../../shared/styles/theme-mongo-cream.css");
@import url("./styles/layout.css");
@import url("./styles/sections.css");
```

常用 token:
- `--bg`
- `--surface`
- `--forest`
- `--dark-green`
- `--green`
- `--text`
- `--muted`
- `--line`
- `--shadow`

常用类:
- `.button`
- `.button-primary`
- `.button-secondary`
- `.button-ghost`
- `.eyebrow`
- `.surface-card`
- `.surface-panel`

建议:
- 颜色、字体、阴影优先走 shared
- 每个作品页面只写自己的布局和交互样式
- 如果后面出现重复组件，再继续补进 `components.css`
