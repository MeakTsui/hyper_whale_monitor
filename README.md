# 🐋 Hyperliquid Telegram Monitor Bot

一个用于监听 Hyperliquid 交易所实时交易数据并推送到 Telegram 频道的机器人系统。

## ✨ 功能特性

- 🔍 **实时监控**：通过 WebSocket 实时监听 Hyperliquid 交易数据
- 📊 **交易通知**：自动捕获开仓、平仓等交易行为并推送到 Telegram
- 👥 **多地址支持**：可同时监听多个钱包地址
- 🔐 **权限管理**：支持多管理员，仅管理员可执行管理命令
- 💾 **数据持久化**：使用 SQLite 存储配置，重启后自动恢复
- 🔄 **自动重连**：WebSocket 断线自动重连，保证服务稳定性
- ❤️ **心跳检测**：定期发送心跳包，确保连接活跃

## 📋 监听事件

- `userFills`：用户成交事件（开仓/平仓）
- `userEvents`：用户事件（资金费、强平等）
- `userNonFundingLedgerUpdates`：账本更新事件

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# Telegram Bot Token (从 @BotFather 获取)
TG_TOKEN=your_telegram_bot_token_here

# Telegram 频道 ID
TG_CHANNEL_ID=@your_channel_id

# Hyperliquid WebSocket URL
HL_WS_URL=wss://api.hyperliquid.xyz/ws
```

### 3. 获取 Telegram Bot Token

1. 在 Telegram 中搜索 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 创建新机器人
3. 按提示设置机器人名称和用户名
4. 获取 Bot Token 并填入 `.env` 文件

### 4. 设置 Telegram 频道

1. 创建一个 Telegram 频道
2. 将你的 Bot 添加为频道管理员
3. 获取频道 ID（格式：`@channelname` 或 `-100xxxxxxxxxx`）

### 5. 添加初始管理员

首次启动前，你需要知道自己的 Telegram User ID：

1. 启动 Bot：`npm start`
2. 在 Telegram 中找到你的 Bot，发送 `/whoami` 获取你的 User ID
3. 停止 Bot（Ctrl+C）
4. 手动添加管理员到数据库，或修改代码在初始化时添加

**方法一：使用 SQLite 命令行**

```bash
sqlite3 data/monitor.db
INSERT INTO admins (user_id) VALUES ('your_user_id');
.exit
```

**方法二：修改代码（临时）**

在 `index.js` 的 `init()` 方法中添加：

```javascript
// 添加初始管理员（仅首次运行）
if (this.db.getAllAdmins().length === 0) {
  this.db.addAdmin('your_user_id');
  console.log('✅ 已添加初始管理员');
}
```

### 6. 启动服务

```bash
npm start
```

## 📱 Bot 命令

### 用户命令

- `/whoami` - 查看你的用户信息（User ID、Username 等）
- `/help` - 显示帮助信息

### 管理员命令

- `/add <address>` - 添加监听地址
- `/remove <address>` - 删除监听地址
- `/list` - 查看当前监听的地址列表
- `/addadmin <user_id>` - 添加新管理员
- `/removeadmin <user_id>` - 删除管理员
- `/admins` - 查看管理员列表

### 使用示例

```
/add 0x1234567890abcdef1234567890abcdef12345678
/remove 0x1234567890abcdef1234567890abcdef12345678
/list
/addadmin 123456789
/admins
```

## 📊 通知格式

当监听到交易时，Bot 会发送如下格式的消息到频道：

```
💥 🟢 开多信号

👤 地址：`0x1234...5678`
💱 币种：BTC
📈 方向：🟢 开多
💰 价格：45000
📊 数量：0.5
🕒 时间：2025-10-30 13:00:00
```

## 🏗️ 项目结构

```
hyper_whale_monitor/
├── index.js                    # 主入口文件
├── package.json                # 项目配置
├── .env                        # 环境变量（需自行创建）
├── .env.example                # 环境变量示例
├── README.md                   # 项目文档
├── data/                       # 数据目录
│   └── monitor.db              # SQLite 数据库（自动创建）
└── src/                        # 源代码目录
    ├── database.js             # 数据库管理模块
    ├── hyperliquid-monitor.js  # Hyperliquid WebSocket 监控模块
    └── telegram-bot.js         # Telegram Bot 模块
```

## 🔧 技术栈

- **Node.js** - 运行环境
- **ws** - WebSocket 客户端
- **node-telegram-bot-api** - Telegram Bot API
- **better-sqlite3** - SQLite 数据库
- **dotenv** - 环境变量管理

## 🛡️ 稳定性保障

- ✅ WebSocket 自动重连机制
- ✅ 心跳检测（30秒间隔）
- ✅ 异常捕获和错误处理
- ✅ 优雅关闭和重启恢复
- ✅ 数据持久化

## 📝 注意事项

1. **地址格式**：Hyperliquid 使用以太坊地址格式（0x 开头，40 位十六进制）
2. **频道权限**：Bot 必须是频道管理员才能发送消息
3. **管理员权限**：只有管理员才能执行管理命令
4. **数据备份**：定期备份 `data/monitor.db` 文件

## 🐛 故障排查

### Bot 无法发送消息到频道

- 检查 Bot 是否被添加为频道管理员
- 确认频道 ID 格式正确
- 检查 Bot Token 是否有效

### WebSocket 连接失败

- 检查网络连接
- 确认 WebSocket URL 正确
- 查看控制台错误日志

### 命令无响应

- 确认你的 User ID 在管理员列表中
- 检查 Bot 是否正常运行
- 查看控制台日志

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请提交 Issue 或联系维护者。

---

**⚠️ 免责声明**：本项目仅供学习和研究使用，使用本项目进行交易监控需遵守相关法律法规和平台规则。
