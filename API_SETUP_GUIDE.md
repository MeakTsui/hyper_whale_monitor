# 🚀 API Webhook 快速配置指南

## ⚡ 5 分钟快速开始

### 步骤 1: 安装新依赖

```bash
npm install
```

这会安装 `axios` 库（用于 HTTP 请求）。

### 步骤 2: 配置环境变量

编辑 `.env` 文件，添加：

```bash
# 启用 API Webhook
API_WEBHOOK_ENABLED=true

# 设置 API 地址
API_WEBHOOK_URL=http://192.168.50.112:8888/open
```

### 步骤 3: 重启应用

```bash
npm start
```

### 步骤 4: 验证配置

查看启动日志，应该看到：

```
🌐 初始化 API 客户端...
✅ API Webhook 已启用: http://192.168.50.112:8888/open
🔍 测试 API 连接: http://192.168.50.112:8888/open
✅ API 连接测试成功: 200
```

## ✅ 完成！

现在每当捕获到交易时，系统会：
1. 发送 Telegram 通知 📱
2. 推送到你的 API 🌐

## 📤 API 请求示例

当捕获到 "开多 BTC" 交易时，会发送：

```json
POST http://192.168.50.112:8888/open
Content-Type: application/json

{
  "type": "3",
  "symbol": "BTC",
  "action": "open",
  "side": "long"
}
```

## 🔧 常见配置

### 禁用 API 推送

```bash
API_WEBHOOK_ENABLED=false
```

### 更改 API 地址

```bash
API_WEBHOOK_URL=http://your-server.com:port/path
```

### 使用 HTTPS

```bash
API_WEBHOOK_URL=https://api.example.com/webhook
```

## 📊 监控日志

### 成功发送

```
📤 [14:30:00] 发送交易信号到 API: {"type":"3","symbol":"BTC","action":"open","side":"long"}
✅ [14:30:00] API 响应成功: 200
```

### 连接失败

```
❌ [14:30:00] API 连接被拒绝: http://192.168.50.112:8888/open
🔄 [14:30:00] 将在 1 秒后重试 (1/3)
```

## 🎯 交易方向映射

| 交易类型 | action | side |
|---------|--------|------|
| 开多 | `open` | `long` |
| 开空 | `open` | `short` |
| 平多 | `close` | `long` |
| 平空 | `close` | `short` |

## 🧪 测试 API

使用 curl 测试你的 API：

```bash
curl -X POST http://192.168.50.112:8888/open \
  -H "Content-Type: application/json" \
  -d '{"type":"3","symbol":"BTC","action":"open","side":"long"}'
```

## ❓ 常见问题

### Q: API 地址必须是公网 IP 吗？
A: 不需要，可以是局域网 IP（如 192.168.x.x）或 localhost。

### Q: 支持 HTTPS 吗？
A: 支持，只需将 URL 改为 `https://` 开头即可。

### Q: 如果 API 服务宕机会怎样？
A: 系统会自动重试 3 次，失败后跳过，不影响 Telegram 通知。

### Q: 可以同时推送到多个 API 吗？
A: 目前只支持一个 API 地址，如需多个可以在你的 API 服务端做转发。

### Q: 如何查看 API 推送状态？
A: 查看控制台日志，所有 API 请求都有详细日志输出。

## 📚 更多信息

详细文档请查看：[API_WEBHOOK.md](./API_WEBHOOK.md)

## 🎉 开始使用

配置完成后，系统会自动将所有交易信号推送到你的 API！
