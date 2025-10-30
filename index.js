require('dotenv').config();
const DatabaseManager = require('./src/database');
const HyperliquidMonitor = require('./src/hyperliquid-monitor');
const TelegramBotManager = require('./src/telegram-bot');

class MonitorApp {
  constructor() {
    this.db = null;
    this.monitor = null;
    this.bot = null;
    this.isShuttingDown = false;
  }

  /**
   * 初始化应用
   */
  async init() {
    try {
      console.log('🚀 正在启动 Hyperliquid Monitor Bot...\n');

      // 验证环境变量
      this.validateEnv();

      // 初始化数据库
      console.log('📦 初始化数据库...');
      this.db = new DatabaseManager();

      // 初始化 Hyperliquid 监控器
      console.log('🔍 初始化 Hyperliquid 监控器...');
      this.monitor = new HyperliquidMonitor(process.env.HL_WS_URL, this.db);

      // 初始化 Telegram Bot
      console.log('🤖 初始化 Telegram Bot...');
      this.bot = new TelegramBotManager(
        process.env.TG_TOKEN,
        process.env.TG_CHANNEL_ID,
        this.db
      );

      // 设置事件监听
      this.setupEventListeners();

      // 连接 WebSocket
      await this.monitor.connect();

      // 恢复监听地址
      await this.restoreAddresses();

      // 发送启动消息
      await this.bot.sendTestMessage();

      console.log('\n✅ 系统启动成功！\n');
      console.log('📊 监听地址数量:', this.monitor.getAddresses().length);
      console.log('👥 管理员数量:', this.db.getAllAdmins().length);
      console.log('\n💡 使用 /help 查看可用命令\n');

    } catch (error) {
      console.error('❌ 初始化失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 验证环境变量
   */
  validateEnv() {
    const required = ['TG_TOKEN', 'TG_CHANNEL_ID', 'HL_WS_URL'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`缺少必需的环境变量: ${missing.join(', ')}`);
    }
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 监听交易事件
    this.monitor.on('trade', async (tradeInfo) => {
      console.log('📊 交易事件:', tradeInfo);
      await this.bot.sendTradeNotification(tradeInfo);
    });

    // 监听用户事件
    this.monitor.on('userEvent', (eventData) => {
      console.log('📢 用户事件:', eventData);
      // 可以根据需要发送通知
    });

    // 监听账本更新
    this.monitor.on('ledgerUpdate', (data) => {
      console.log('💰 账本更新:', data);
      // 可以根据需要发送通知
    });

    // 监听 WebSocket 连接状态
    this.monitor.on('connected', () => {
      console.log('✅ WebSocket 已连接');
    });

    this.monitor.on('error', (error) => {
      console.error('❌ WebSocket 错误:', error.message);
    });

    // Bot 事件：添加地址
    this.bot.on('addressAdded', (address) => {
      console.log('➕ 添加地址:', address);
      this.monitor.subscribe(address);
    });

    // Bot 事件：删除地址
    this.bot.on('addressRemoved', (address) => {
      console.log('➖ 删除地址:', address);
      this.monitor.unsubscribe(address);
    });

    // 处理进程信号
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));

    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('❌ 未捕获的异常:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ 未处理的 Promise 拒绝:', reason);
    });
  }

  /**
   * 恢复监听地址
   */
  async restoreAddresses() {
    const addresses = this.db.getAllAddresses();
    
    if (addresses.length === 0) {
      console.log('ℹ️  没有需要恢复的监听地址');
      return;
    }

    console.log(`🔄 正在恢复 ${addresses.length} 个监听地址...`);
    
    for (const address of addresses) {
      this.monitor.subscribe(address);
    }

    console.log('✅ 地址恢复完成');
  }

  /**
   * 优雅关闭
   */
  async shutdown(signal) {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log(`\n⚠️  收到 ${signal} 信号，正在关闭...`);

    try {
      // 停止 Telegram Bot
      if (this.bot) {
        console.log('🛑 停止 Telegram Bot...');
        this.bot.stop();
      }

      // 断开 WebSocket
      if (this.monitor) {
        console.log('🔌 断开 WebSocket...');
        this.monitor.disconnect();
      }

      // 关闭数据库
      if (this.db) {
        console.log('💾 关闭数据库...');
        this.db.close();
      }

      console.log('✅ 已安全关闭');
      process.exit(0);
    } catch (error) {
      console.error('❌ 关闭时出错:', error.message);
      process.exit(1);
    }
  }
}

// 启动应用
const app = new MonitorApp();
app.init().catch(error => {
  console.error('❌ 应用启动失败:', error);
  process.exit(1);
});
