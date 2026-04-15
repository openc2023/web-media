# 山海 (Shanhai) - 新媒体艺术交互项目

![版本](https://img.shields.io/badge/版本-1.0.0-blue)
![许可证](https://img.shields.io/badge/许可证-MIT-green)

## 项目简介

山海是一个基于Web技术的新媒体艺术交互项目，通过HTML5 Canvas创建动态视觉效果。项目展示了多条脉冲线动画，具有随机峰值、垂直渐变拖尾等视觉特效，为用户提供沉浸式的视觉体验。

## 主要特点

- **动态脉冲线**：生成具有3-6个随机峰值的动态线条
- **视觉效果**：整条线具有垂直渐变拖尾效果
- **交互控制**：
  - 空格键：暂停/继续动画
  - R键：重置所有线条
  - T键：切换残影效果
  - 点击：重置线条
- **性能优化**：
  - 数学函数缓存
  - 帧率控制
  - 选择性渲染

## 技术栈

- HTML5
- CSS3
- JavaScript (原生)
- Canvas API

## 安装与使用

1. 克隆仓库
   ```
   git clone https://github.com/yourusername/shanhai.git
   ```

2. 使用Web服务器打开项目
   可以使用任何Web服务器（如Apache、Nginx）或简单的开发服务器：
   ```
   # 如果安装了Node.js，可以使用http-server
   npx http-server
   ```

3. 在浏览器中访问
   ```
   http://localhost:8080/shanhai/shaihai.html
   ```

## 项目结构

```
shanhai/
├── old/                # 旧版本文件
├── shanhai/            # 当前版本
│   ├── shaihai.html    # 主HTML文件
│   ├── styles.css      # 样式文件
│   └── script.js       # JavaScript脚本
└── readme.md           # 项目说明
```

## 贡献

欢迎提交问题和拉取请求。对于重大更改，请先开issue讨论您想要更改的内容。

## 许可证

[MIT](https://choosealicense.com/licenses/mit/)