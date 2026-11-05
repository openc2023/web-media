# Ghost Mirror · 破碎鬼镜 · 깨지는 귀신 거울

鬼神系列 01。屏幕当镜子：有人靠近、正脸看镜子，镜面慢慢结霜、出现污痕和裂痕；脸上出现裂纹（每人随机颜色），再浮现会频闪的鬼脸面具，偶尔整张闪到屏幕前。没人时边缘有活动的冰霜、污痕和信号毛刺吸引人靠近。

- 打开即用（需要 https 或 localhost、允许摄像头、联网加载 MediaPipe 模型）。建议桌面版 Chrome。
- 画面上没有界面：按 **S** 或连点右上角三下打开设置；**D** 识别叠加，**P** 模拟有人（没人时用官方模型生成假脸预览），**F** 全屏。
- 人脸：MediaPipe Face Landmarker（最多 5 人）+ 多类分割（遮挡）。面具贴图按 MediaPipe 官方 canonical_face_model 的 UV 布局，WebGL 贴到脸上。
- `assets/face_uv.json`：由官方 `canonical_face_model.obj`（google-ai-edge/mediapipe）转出的 UV、三角面和顶点。
- 设置保存在各自浏览器的 localStorage。
