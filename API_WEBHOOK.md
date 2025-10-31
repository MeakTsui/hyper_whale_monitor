# 🌐 API Webhook 集成指南

## 📊 功能说明

系统现在支持将交易信号实时推送到外部 API，可以用于：
- 自动交易系统集成
- 交易信号分发
- 数据分析平台对接
- 第三方系统通知

## 🔧 配置方法

### 1. 环境变量配置

编辑 `.env` 文件，添加以下配置：

```bash
# 外部 API 配置
API_WEBHOOK_URL=http://192.168.50.112:8888/open
API_WEBHOOK_ENABLED=true
```

### 2. 配置说明

| 变量名 | 说明 | 示例 | 必填 |
|--------|------|------|------|
| `API_WEBHOOK_URL` | API 推送地址 | `http://192.168.50.112:8888/open` | 否 |
| `API_WEBHOOK_ENABLED` | 是否启用推送 | `true` 或 `false` | 否 |

**注意：**
- 如果 `API_WEBHOOK_ENABLED` 为 `false` 或未设置，系统不会发送 API 请求
- `API_WEBHOOK_URL` 可以是任何支持 HTTP POST 的地址

## 📤 请求格式

### HTTP 请求

```http
POST /open HTTP/1.1
Host: 192.168.50.112:8888
Content-Type: application/json

{
  "type": "3",
  "symbol": "BTC",
  "action": "open",
  "side": "long"
}
```

### 字段说明

| 字段 | 类型 | 说明 | 可能值 |
|------|------|------|--------|
| `type` | String | 信号类型（固定值） | `"3"` |
| `symbol` | String | 交易币种 | `"BTC"`, `"ETH"`, `"SOL"` 等 |
| `action` | String | 开平仓动作 | `"open"` (开仓), `"close"` (平仓) |
| `side` | String | 多空方向 | `"long"` (多), `"short"` (空) |

### 方向映射规则

| Hyperliquid 方向 | action | side |
|------------------|--------|------|
| `Open Long` | `open` | `long` |
| `Open Short` | `open` | `short` |
| `Close Long` | `close` | `long` |
| `Close Short` | `close` | `short` |

## 📋 请求示例

### 示例 1: 开多 BTC
```json
{
  "type": "3",
  "symbol": "BTC",
  "action": "open",
  "side": "long"
}
```

### 示例 2: 平空 ETH
```json
{
  "type": "3",
  "symbol": "ETH",
  "action": "close",
  "side": "short"
}
```

### 示例 3: 开空 SOL
```json
{
  "type": "3",
  "symbol": "SOL",
  "action": "open",
  "side": "short"
}
```

### 示例 4: 平多 BTC
```json
{
  "type": "3",
  "symbol": "BTC",
  "action": "close",
  "side": "long"
}
```

## 🔄 工作流程

```
交易事件触发
    ↓
生成交易信号
    ↓
┌─────────────────┐
│ 发送 Telegram   │
│ 通知            │
└─────────────────┘
    ↓
┌─────────────────┐
│ 发送到外部 API  │ ← API_WEBHOOK_ENABLED=true
│ (如果启用)      │
└─────────────────┘
    ↓
┌─────────────────┐
│ 加入请求队列    │
└─────────────────┘
    ↓
┌─────────────────┐
│ 异步发送 POST   │
│ 请求            │
└─────────────────┘
    ↓
┌─────────────────┐
│ 处理响应/重试   │
└─────────────────┘
```

## 📊 日志输出

### 启动时

```bash
🌐 初始化 API 客户端...
✅ API Webhook 已启用: http://192.168.50.112:8888/open
🔍 测试 API 连接: http://192.168.50.112:8888/open
✅ API 连接测试成功: 200
```

或（未启用时）：

```bash
🌐 初始化 API 客户端...
ℹ️  API Webhook 未启用
```

### 发送请求时

```bash
📤 [14:30:00] 发送交易信号到 API: {"type":"3","symbol":"BTC","action":"open","side":"long"}
✅ [14:30:00] API 响应成功: 200 { success: true }
```

### 请求失败时

```bash
📤 [14:30:00] 发送交易信号到 API: {"type":"3","symbol":"BTC","action":"close","side":"short"}
❌ [14:30:00] API 连接被拒绝: http://192.168.50.112:8888/open
🔄 [14:30:00] 将在 1 秒后重试 (1/3)
```

### 重试机制

```bash
❌ [14:30:01] API 请求超时
🔄 [14:30:01] 将在 1 秒后重试 (2/3)
❌ [14:30:02] API 响应错误: 500 Internal Server Error
🔄 [14:30:02] 将在 1 秒后重试 (3/3)
❌ [14:30:03] 达到最大重试次数，放弃发送
```

## ⚙️ 高级配置

### 修改重试参数

编辑 `src/api-client.js`:

```javascript
constructor(webhookUrl, enabled = false) {
  this.webhookUrl = webhookUrl;
  this.enabled = enabled;
  this.retryDelay = 1000;    // 重试延迟（毫秒）
  this.maxRetries = 3;       // 最大重试次数
  // ...
}
```

### 修改超时时间

```javascript
const response = await axios.post(this.webhookUrl, payload, {
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 5000  // 超时时间（毫秒）
});
```

### 修改处理间隔

```javascript
startQueueProcessor() {
  setInterval(async () => {
    // ...
  }, 500); // 处理间隔（毫秒）
}
```

## 🧪 测试 API

### 方法 1: 使用 curl

```bash
curl -X POST http://192.168.50.112:8888/open \
  -H "Content-Type: application/json" \
  -d '{
    "type": "3",
    "symbol": "BTC",
    "action": "open",
    "side": "long"
  }'
```

### 方法 2: 使用 Python

```python
import requests

url = "http://192.168.50.112:8888/open"
payload = {
    "type": "3",
    "symbol": "BTC",
    "action": "open",
    "side": "long"
}

response = requests.post(url, json=payload)
print(response.status_code)
print(response.json())
```

### 方法 3: 使用 Node.js

```javascript
const axios = require('axios');

axios.post('http://192.168.50.112:8888/open', {
  type: "3",
  symbol: "BTC",
  action: "open",
  side: "long"
})
.then(response => {
  console.log(response.status);
  console.log(response.data);
})
.catch(error => {
  console.error(error.message);
});
```

## 🔍 故障排查

### 问题 1: 连接被拒绝

**错误信息：**
```
❌ API 连接被拒绝: http://192.168.50.112:8888/open
```

**可能原因：**
- API 服务未启动
- IP 地址或端口错误
- 防火墙阻止连接

**解决方法：**
1. 检查 API 服务是否运行
2. 验证 URL 配置是否正确
3. 检查防火墙设置

### 问题 2: 请求超时

**错误信息：**
```
❌ API 请求超时
```

**可能原因：**
- 网络延迟过高
- API 服务响应慢
- 超时时间设置过短

**解决方法：**
1. 检查网络连接
2. 优化 API 服务性能
3. 增加超时时间（修改代码）

### 问题 3: HTTP 错误

**错误信息：**
```
❌ API 响应错误: 500 Internal Server Error
```

**可能原因：**
- API 服务内部错误
- 请求格式不正确
- API 服务配置问题

**解决方法：**
1. 查看 API 服务日志
2. 验证请求格式
3. 联系 API 服务管理员

## 📈 性能优化

### 1. 队列机制
- 异步处理，不阻塞主流程
- 每 500ms 处理一个请求
- 避免并发请求过多

### 2. 重试机制
- 自动重试失败的请求
- 指数退避（可配置）
- 最多重试 3 次

### 3. 超时控制
- 5 秒超时限制
- 避免长时间等待
- 及时释放资源

## 🔒 安全建议

### 1. 使用 HTTPS
```bash
API_WEBHOOK_URL=https://api.example.com/webhook
```

### 2. 添加认证
修改 `src/api-client.js`，添加认证头：

```javascript
const response = await axios.post(this.webhookUrl, payload, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_TOKEN',
    'X-API-Key': 'YOUR_API_KEY'
  },
  timeout: 5000
});
```

### 3. IP 白名单
在 API 服务端配置 IP 白名单，只允许特定 IP 访问。

### 4. 请求签名
实现请求签名机制，验证请求来源。

## 🚀 启动应用

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
nano .env
```

### 3. 启动服务

```bash
npm start
```

### 4. 验证配置

查看启动日志，确认 API Webhook 状态：

```bash
✅ API Webhook 已启用: http://192.168.50.112:8888/open
✅ API 连接测试成功: 200
```

## 💡 使用场景

### 场景 1: 自动交易系统
接收交易信号，自动执行交易策略。

### 场景 2: 信号分发
将信号转发到多个交易平台。

### 场景 3: 数据分析
收集交易数据，进行实时分析。

### 场景 4: 风险监控
监控大额交易，触发风控预警。

## 📝 总结

通过 API Webhook 集成：
- ✅ 实时推送交易信号
- ✅ 支持自定义 API 地址
- ✅ 自动重试机制
- ✅ 完善的错误处理
- ✅ 灵活的配置选项

现在你的系统可以无缝对接外部 API，实现更强大的功能！🚀
