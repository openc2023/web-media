# 声音翻纸牌 · 网页测试版

由独立 macOS 开发项目的 Web preset 导出，使用 Compatibility/WebGL 和单线程。

## Mac 本机运行

1. 解压整个文件夹，保留全部文件。
2. 安装 Python 3 后，在终端进入此文件夹并执行 `python3 serve.py`。
3. 浏览器打开 `http://localhost:8765/`。不要直接双击 index.html。
4. 点击游戏画面激活浏览器音频，允许麦克风权限。
5. Esc 打开设置，在互动页观察声音条并调整灵敏度。
6. 如 F11 被 macOS 截获，使用设置中的全屏开关。浏览器可以通过 Esc 退出全屏。

START_MAC.command 提供同样的启动入口；若不可执行，可用终端运行
`zsh START_MAC.command`。Windows 安装 Python 后运行 START_WINDOWS.bat。

## 通过网址访问

可以将全部导出文件部署到支持 .wasm 的 HTTPS 静态服务器。
届时 Mac 无需安装 Godot 或 Python，打开该 HTTPS 地址并允许麦克风即可。
在线测试地址：https://openc2023.github.io/web-media/neu/sound-ttakji/
通过其他电脑的局域网 HTTP IP 地址访问不满足常见浏览器的麦克风安全要求。

## 浏览器限制

- 麦克风需要 HTTPS 或 localhost，并需用户授权。
- 切换设备受浏览器限制；必要时在浏览器的网站权限中选择输入设备并刷新。
- 设置和排行榜通过浏览器本地存储保存；隐私模式或清除站点数据会影响保存。
- 后台标签页可能暂停或降速，展览时应保持页面在前台并禁止系统睡眠。
- 浏览器授权、Intel Mac 显卡性能和连续运行稳定性仍需实机验证。

## 麦克风授权与异常排查

1. 首次启动由工作人员点击画面并允许麦克风。应用无法代替用户批准权限。
2. 先检查浏览器当前网站的麦克风权限；Safari 在“设置 → 网站 → 麦克风”调整。
3. 再检查 macOS“系统设置 → 隐私与安全性 → 麦克风”中所用浏览器的权限。
4. 如果曾拒绝权限，修改权限后刷新网页；必要时退出并重新打开浏览器。
5. 更换麦克风时，先在系统或浏览器中选择正确输入设备，再刷新网页并观察实时声音条。
6. USB 断开、系统睡眠、音频设备切换后，不能保证浏览器自动恢复。
   先尝试页面中的设备刷新，再尝试刷新网页；后台程序不能绕过权限重新授权。
7. 无声音时先检查系统输入电平、输入音量、静音开关和麦克风连接。
   关闭占用设备的其他应用后再试；不能仅凭“已经授权”判断音频确实流入。
8. 浏览器可能进行降噪、自动增益或回声消除，拍击波形和桌面版可能不同。
   对最终麦克风和最终浏览器重新校准，不能直接照搬桌面版灵敏度。
9. 用直接网页地址打开。如果嵌入 iframe，父页面还必须按浏览器要求授权 microphone/fullscreen，
   并检查服务器 Permissions-Policy 没有禁用麦克风。
10. 浏览器关闭后不会由网页自己重启；无人值守的自动启动和崩溃恢复需要操作系统配合。

## 展览前实际检查

- 正常授权、拒绝授权再恢复、USB 拔插、睡眠唤醒分别测试。
- 保持同一个浏览器、用户配置和网址（包括端口）；换网址可能重新授权并使用另一份存档。
- 避免隐私浏览，不清理站点数据。排行榜目前为本机保存，不是跨电脑共享排行。
- 保持网页前台，关闭系统睡眠和屏保。后台计时与麦克风连续性不能视为可靠。
- 浏览器全屏必须由用户操作发起，Esc 可能先退出浏览器全屏，再由游戏接收按键。
- 连续运行 8–12 小时，检查声音条、触发延迟、FPS、内存、全屏及存档恢复。

## 字体修复

英文和数字恢复原版 Godot 的 Open Sans SemiBold；中韩文字使用 Noto Sans KR 与 Noto Sans SC 作为后备字库。
原 Windows 系统后备字体为 Malgun Gothic / Microsoft YaHei，中韩字形细节可能与 Windows 系统字体不同。
更换新版时应替换全部文件，尤其 index.pck；浏览器强制刷新，避免继续读取旧包。
字体使用 SIL Open Font License，许可证随包提供。

参考：https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
https://support.apple.com/en-ca/guide/safari/ibrw7f78f7fe/mac
https://support.apple.com/en-za/guide/mac-help/mchl7fa8e3cc/mac
https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/microphone
