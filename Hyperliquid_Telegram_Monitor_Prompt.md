你是高级全栈开发专家，请帮我生成一个完整的 Node.js 项目，实现以下功能：

🧩 项目名称：Hyperliquid Telegram Monitor Bot

🎯 功能目标：
开发一个机器人系统，用于监听 Hyperliquid WebSocket 实时数据，并将特定账户的交易行为（如开仓、平仓、余额变动等）实时发送到 Telegram 频道。

🧠 系统需求详情如下：

1️⃣ 实时监控模块
- 使用 Hyperliquid WebSocket API (`wss://api.hyperliquid.xyz/ws`), 相关文档链接：https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/timeouts-and-heartbeats。
- 订阅以下事件：
  - `userFills`：捕捉开仓/平仓成交；
  - `userEvents`：捕捉资金费、强平事件；
  - （可扩展）`userNonFundingLedgerUpdates`；
- 支持同时订阅多个地址；
- 每个地址可以动态添加/删除监听；
- 每当捕获到开/平仓成交时，发送格式化消息到 Telegram 频道；
- 消息格式（Markdown）：
  ```
  💥 *开仓 / 平仓信号*
  👤 地址：`0xabc...`
  💱 币种：BTC
  📈 方向：🟢 开多 / 🔴 平空
  💰 价格：12345
  📊 数量：0.5
  🕒 时间：2025-10-30 13:00:00
  ```

2️⃣ Telegram Bot 模块
- 使用 `node-telegram-bot-api`；
- 管理命令：
  - `/add <address>`：添加地址；
  - `/remove <address>`：删除地址；
  - `/list`：查看监听列表；
  - `/whoami`：返回发送者的 user_id；
  - `/addadmin <user_id>`：添加管理员；
  - `/removeadmin <user_id>`：删除管理员；
  - `/admins`：列出管理员；
- 仅管理员可执行管理命令；
- Bot 将所有监听事件推送到指定频道（`.env` 配置）。

3️⃣ 数据持久化
- 使用SQLite 存储：
  - 监听地址；
  - 管理员列表；
- 程序重启后自动恢复。

4️⃣ 项目配置
- 使用 `.env` 文件配置：
  ```
  TG_TOKEN=xxxx
  TG_CHANNEL_ID=@yourchannel
  HL_WS_URL=wss://api.hyperliquid.xyz/ws
  ```
- 启动命令：
  ```
  node index.js
  ```

5️⃣ 稳定性要求
- 自动重连 WebSocket；
- 捕获异常时打印错误；
- 订阅和取消订阅实时同步；
- 优雅退出与重启恢复。

🧑‍💻 输出要求：
- 提供完整的项目结构；
- 包含可直接运行的 `index.js`；
- 附带 `package.json`；
- 使用 async/await 风格；
- 格式清晰，注释完善。
