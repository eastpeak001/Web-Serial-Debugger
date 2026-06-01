# Web Serial Debugger

Web Serial Debugger 是一个基于浏览器能力的网页调试助手，支持 USB Web Serial 和 BLE Bluetooth 两种连接模式，可用于 USB 串口设备以及 BLE GATT 外设的基础收发调试。

在线预览：
https://eastpeak001.github.io/Web-Serial-Debugger/

推荐使用 Chrome 或 Edge 浏览器打开。Web Serial API 和 Web Bluetooth 通常需要 HTTPS 或 localhost 环境。如果在线页面无法连接设备，可以使用本地方式运行。

## 运行方式

不要直接双击 `index.html` 作为主要测试方式。建议通过本地 HTTP 服务器运行：

```bash
python -m http.server 8000
```

然后在 Chrome 或 Edge 中打开：

```text
http://127.0.0.1:8000/index.html
```

## 连接模式

### USB Serial

默认模式为 `USB Serial`，使用浏览器 Web Serial API 连接 USB 串口设备。连接后可以进行文本发送、HEX 发送、接收显示、日志保存、Plotter 绘图等操作。

### BLE Bluetooth

`BLE Bluetooth` 模式基于 Web Bluetooth BLE GATT，不是传统蓝牙 SPP COM 口。默认使用 Nordic UART Service UUID：

- Service UUID: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- TX Notify UUID: `6e400003-b5a3-f393-e0a9-e50e24dcca9e`
- RX Write UUID: `6e400002-b5a3-f393-e0a9-e50e24dcca9e`

BLE 模式会通过 Notify 接收数据，通过 Write Characteristic 发送数据。不同 BLE 外设可能使用不同的 Service / Characteristic UUID，需要按设备文档填写。

## 主要功能

- USB Serial 连接 / 断开
- BLE Bluetooth GATT 连接 / 断开
- 波特率选择，USB Serial 默认 `115200`
- BLE Service UUID / TX Notify UUID / RX Write UUID 配置保存
- 串口或 BLE 接收显示
- 文本发送和 HEX 发送
- 发送结尾 `None` / `LF` / `CRLF`
- `[TX]` / `[TX HEX]` / `[SYS]` 日志记录
- HEX 显示
- 自动滚动
- 显示时间戳
- 暂停接收显示
- 搜索、仅显示匹配行、快捷搜索
- 最大日志行数限制
- 日志统计栏
- 保存日志为 TXT
- 复制日志
- 复制设备信息
- 发送历史
- 多行发送
- 发送前确认
- 实时曲线 Plotter
- Plotter 支持全局缩放、每变量独立缩放、鼠标悬停、滚轮缩放、重置缩放、隐藏/显示
- 状态栏提示

## 使用步骤

1. 启动本地服务器：`python -m http.server 8000`
2. 打开 `http://127.0.0.1:8000/index.html`
3. 选择连接模式：`USB Serial` 或 `BLE Bluetooth`
4. USB Serial 模式下选择波特率，然后点击连接并选择 COM 设备
5. BLE Bluetooth 模式下确认 UUID 配置，然后点击连接并选择 BLE 设备
6. 输入内容并发送
7. 需要保存记录时，点击“保存日志”

## 实时曲线 Plotter

启用实时曲线后，工具会从普通文本接收行中按变量名提取数值，例如 `CO2=850`、`T:29.5`、`RH=55.2`。Plotter 支持 `key=value`、`key:value`、带单位、`CO2 raw`、`filtered`、`X/Y` 坐标等常见格式。HEX 显示模式下不解析曲线数据。

## 快捷键

- 单行模式：发送输入框获得焦点时，按 `Enter` 发送当前内容
- 多行模式：按 `Ctrl + Enter` 发送，`Enter` 在输入框内换行
- `Ctrl + L`：清空接收区
- `Esc`：清空搜索框并恢复全部日志显示

## 常见问题

### 打开后显示目录列表怎么办？

确认浏览器地址是否打开到了项目目录根路径。请访问：

```text
http://127.0.0.1:8000/index.html
```

### 浏览器不支持 Web Serial API 怎么办？

请使用 Chrome 或 Edge 浏览器。Web Serial API 需要浏览器支持，并且通常需要 HTTPS 或 localhost 环境。

### 浏览器不支持 Web Bluetooth 怎么办？

请使用支持 Web Bluetooth 的 Chrome 或 Edge，并通过 HTTPS 或 localhost 打开页面。部分系统、浏览器版本或平台可能不支持 Web Bluetooth。

### 点击连接后提示 No port selected 怎么办？

这通常表示在浏览器设备选择窗口中取消了选择，或没有选中任何设备。请重新点击连接并选择正确设备。

### 为什么 HEX 发送时不追加换行？

HEX 发送用于发送二进制字节。为了避免破坏二进制数据，开启 HEX 发送后不会追加 `None` / `LF` / `CRLF` 中的任何发送结尾。

### 为什么打开 file:/// 路径不建议使用？

Web Serial 和 Web Bluetooth 更适合在 HTTPS 或 localhost 环境中测试。使用本地 HTTP 服务打开页面，更接近实际网页运行环境，也更便于排查浏览器权限和资源加载问题。

## 后续计划

- 优化移动端布局
- 增加更多统计项
- 增强 BLE 设备配置体验
