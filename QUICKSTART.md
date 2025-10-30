# 🚀 快速启动指南

## 第一步：安装依赖

```bash
npm install
```

## 第二步：配置环境变量

1. 复制环境变量模板：

```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入以下信息：

```env
TG_TOKEN=你的_Telegram_Bot_Token
TG_CHANNEL_ID=@你的频道ID
HL_WS_URL=wss://api.hyperliquid.xyz/ws
```

### 如何获取 Telegram Bot Token？

1. 在 Telegram 搜索 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 命令
3. 按提示设置机器人名称和用户名
4. 复制获得的 Token

### 如何获取频道 ID？

**方法一：使用频道用户名**
- 格式：`@channelname`（例如：`@mychannel`）

**方法二：使用数字 ID**
1. 将 Bot 添加到频道
2. 在频道发送一条消息
3. 访问：`https://api.telegram.org/bot<你的TOKEN>/getUpdates`
4. 找到 `"chat":{"id":-100xxxxxxxxxx}` 中的 ID

## 第三步：获取你的 User ID

1. 临时启动 Bot：

```bash
npm start
```

2. 在 Telegram 中找到你的 Bot，发送：

```
/whoami
```

3. Bot 会返回你的 User ID，记下这个数字
4. 按 `Ctrl+C` 停止 Bot

## 第四步：添加管理员

运行管理员设置工具：

```bash
npm run setup
```

按提示输入你的 User ID 添加为管理员。

## 第五步：启动服务

```bash
npm start
```

看到以下信息表示启动成功：

```
✅ 系统启动成功！

📊 监听地址数量: 0
👥 管理员数量: 1

💡 使用 /help 查看可用命令
```

## 第六步：添加监听地址

在 Telegram 中向 Bot 发送：

```
/add 0x1234567890abcdef1234567890abcdef12345678
```

替换为你要监听的实际地址。

## 第七步：查看监听列表

```
/list
```

## 完成！🎉

现在你的 Bot 已经开始监听交易了。当有交易发生时，会自动推送到你的 Telegram 频道。

## 常用命令

```
/add <address>      - 添加监听地址
/remove <address>   - 删除监听地址
/list               - 查看监听列表
/addadmin <user_id> - 添加管理员
/admins             - 查看管理员列表
/help               - 查看帮助
```

## 遇到问题？

查看 [README.md](./README.md) 中的故障排查部分。
