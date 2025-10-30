const TelegramBot = require('node-telegram-bot-api');

class TelegramBotManager {
  constructor(token, channelId, database) {
    this.bot = new TelegramBot(token, { polling: true });
    this.channelId = channelId;
    this.db = database;
    
    // 消息队列和速率限制
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.minMessageInterval = 1000; // 最小消息间隔（毫秒）
    this.lastMessageTime = 0;
    
    // 交易批处理
    this.tradeBatch = [];
    this.batchTimeout = null;
    this.batchWindow = 3000; // 3秒内的交易合并为一条消息
    this.maxBatchSize = 10; // 最多合并10笔交易
    
    this.setupCommands();
    this.startQueueProcessor();
  }

  /**
   * 设置机器人命令
   */
  setupCommands() {
    // /whoami - 获取用户 ID
    this.bot.onText(/\/whoami/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = msg.from.username || '无用户名';
      
      this.bot.sendMessage(chatId, 
        `👤 *你的信息*\n\n` +
        `🆔 User ID: \`${userId}\`\n` +
        `👨‍💼 Username: @${username}\n` +
        `💬 Chat ID: \`${chatId}\``,
        { parse_mode: 'Markdown' }
      );
    });

    // /add <address> - 添加监听地址
    this.bot.onText(/\/add (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.db.isAdmin(userId)) {
        this.bot.sendMessage(chatId, '❌ 你没有权限执行此命令');
        return;
      }

      const address = match[1].trim();
      
      if (!this.isValidAddress(address)) {
        this.bot.sendMessage(chatId, '❌ 地址格式无效');
        return;
      }

      const success = this.db.addAddress(address);
      if (success) {
        this.bot.sendMessage(chatId, `✅ 已添加监听地址: \`${address}\``, { parse_mode: 'Markdown' });
        // 触发订阅事件
        this.emit('addressAdded', address);
      } else {
        this.bot.sendMessage(chatId, '⚠️ 该地址已在监听列表中');
      }
    });

    // /remove <address> - 删除监听地址
    this.bot.onText(/\/remove (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.db.isAdmin(userId)) {
        this.bot.sendMessage(chatId, '❌ 你没有权限执行此命令');
        return;
      }

      const address = match[1].trim();
      const success = this.db.removeAddress(address);
      
      if (success) {
        this.bot.sendMessage(chatId, `✅ 已删除监听地址: \`${address}\``, { parse_mode: 'Markdown' });
        // 触发取消订阅事件
        this.emit('addressRemoved', address);
      } else {
        this.bot.sendMessage(chatId, '⚠️ 该地址不在监听列表中');
      }
    });

    // /list - 查看监听列表
    this.bot.onText(/\/list/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.db.isAdmin(userId)) {
        this.bot.sendMessage(chatId, '❌ 你没有权限执行此命令');
        return;
      }

      const addresses = this.db.getAllAddresses();
      
      if (addresses.length === 0) {
        this.bot.sendMessage(chatId, '📋 监听列表为空');
        return;
      }

      let message = `📋 *监听地址列表* (${addresses.length})\n\n`;
      addresses.forEach((addr, index) => {
        message += `${index + 1}. \`${addr}\`\n`;
      });

      this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // /addadmin <user_id> - 添加管理员
    this.bot.onText(/\/addadmin (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.db.isAdmin(userId)) {
        this.bot.sendMessage(chatId, '❌ 你没有权限执行此命令');
        return;
      }

      const newAdminId = match[1].trim();
      const success = this.db.addAdmin(newAdminId);
      
      if (success) {
        this.bot.sendMessage(chatId, `✅ 已添加管理员: \`${newAdminId}\``, { parse_mode: 'Markdown' });
      } else {
        this.bot.sendMessage(chatId, '⚠️ 该用户已是管理员');
      }
    });

    // /removeadmin <user_id> - 删除管理员
    this.bot.onText(/\/removeadmin (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.db.isAdmin(userId)) {
        this.bot.sendMessage(chatId, '❌ 你没有权限执行此命令');
        return;
      }

      const adminId = match[1].trim();
      
      // 防止删除自己
      if (adminId === userId.toString()) {
        this.bot.sendMessage(chatId, '❌ 不能删除自己的管理员权限');
        return;
      }

      const success = this.db.removeAdmin(adminId);
      
      if (success) {
        this.bot.sendMessage(chatId, `✅ 已删除管理员: \`${adminId}\``, { parse_mode: 'Markdown' });
      } else {
        this.bot.sendMessage(chatId, '⚠️ 该用户不是管理员');
      }
    });

    // /admins - 列出所有管理员
    this.bot.onText(/\/admins/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.db.isAdmin(userId)) {
        this.bot.sendMessage(chatId, '❌ 你没有权限执行此命令');
        return;
      }

      const admins = this.db.getAllAdmins();
      
      if (admins.length === 0) {
        this.bot.sendMessage(chatId, '📋 管理员列表为空');
        return;
      }

      let message = `👥 *管理员列表* (${admins.length})\n\n`;
      admins.forEach((id, index) => {
        message += `${index + 1}. \`${id}\`\n`;
      });

      this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // /help - 帮助信息
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const helpMessage = `
🤖 *Hyperliquid Monitor Bot 帮助*

*用户命令：*
/whoami - 查看你的用户信息

*管理员命令：*
/add <address> - 添加监听地址
/remove <address> - 删除监听地址
/list - 查看监听列表
/addadmin <user_id> - 添加管理员
/removeadmin <user_id> - 删除管理员
/admins - 查看管理员列表
/help - 显示此帮助信息

*使用示例：*
\`/add 0x1234567890abcdef\`
\`/remove 0x1234567890abcdef\`
\`/addadmin 123456789\`
      `;

      this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    });

    // 错误处理
    this.bot.on('polling_error', (error) => {
      console.error('❌ Telegram 轮询错误:', error.message);
    });

    console.log('✅ Telegram Bot 命令已设置');
  }

  /**
   * 验证地址格式（简单验证）
   */
  isValidAddress(address) {
    // Hyperliquid 使用以太坊地址格式
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * 发送交易通知到频道（使用批处理）
   */
  async sendTradeNotification(tradeInfo) {
    // 将交易添加到批处理队列
    this.tradeBatch.push(tradeInfo);
    
    // 清除之前的定时器
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    // 如果达到最大批次大小，立即发送
    if (this.tradeBatch.length >= this.maxBatchSize) {
      await this.flushTradeBatch();
    } else {
      // 否则等待批处理窗口结束
      this.batchTimeout = setTimeout(() => {
        this.flushTradeBatch();
      }, this.batchWindow);
    }
  }
  
  /**
   * 发送批处理的交易通知
   */
  async flushTradeBatch() {
    if (this.tradeBatch.length === 0) return;
    
    const trades = [...this.tradeBatch];
    this.tradeBatch = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    try {
      let message = '';
      
      if (trades.length === 1) {
        // 单笔交易，使用详细格式
        message = this.formatSingleTrade(trades[0]);
      } else {
        // 多笔交易，使用汇总格式
        message = this.formatBatchTrades(trades);
      }
      
      // 添加到消息队列
      this.queueMessage(message);
      
    } catch (error) {
      console.error('❌ 处理交易批次失败:', error.message);
    }
  }
  
  /**
   * 格式化单笔交易
   */
  formatSingleTrade(tradeInfo) {
    const { address, coin, side, price, size, timestamp, direction, closedPnl } = tradeInfo;
    
    // 确定交易类型和图标
    let actionEmoji = '';
    let actionText = '';
    
    if (direction.includes('Open')) {
      if (direction.includes('Long')) {
        actionEmoji = '🟢';
        actionText = '开多';
      } else {
        actionEmoji = '🔴';
        actionText = '开空';
      }
    } else if (direction.includes('Close')) {
      if (direction.includes('Long')) {
        actionEmoji = '🟡';
        actionText = '平多';
      } else {
        actionEmoji = '🟠';
        actionText = '平空';
      }
    }

    // 格式化时间（完整日期+时间）
    const date = new Date(timestamp);
    const dateStr = date.toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // 计算交易金额
    const tradeValue = (parseFloat(price) * parseFloat(size)).toFixed(2);

    // 构建消息
    let message = `💥 *${actionEmoji} ${actionText}信号*\n`;
    message += `${'='.repeat(32)}\n\n`;
    message += `👤 *地址*\n\`${address}\`\n\n`;
    message += `💱 *币种：* ${coin}\n`;
    message += `📈 *方向：* ${actionEmoji} ${actionText}\n`;
    message += `💰 *价格：* $${price}\n`;
    message += `📊 *数量：* ${size} ${coin}\n`;
    message += `💵 *金额：* $${tradeValue}\n`;
    
    // 如果有盈亏信息
    if (closedPnl && parseFloat(closedPnl) !== 0) {
      const pnl = parseFloat(closedPnl);
      const pnlEmoji = pnl > 0 ? '💚' : '💔';
      const pnlPercent = ((pnl / parseFloat(tradeValue)) * 100).toFixed(2);
      message += `${pnlEmoji} *盈亏：* ${pnl > 0 ? '+' : ''}$${pnl} (${pnl > 0 ? '+' : ''}${pnlPercent}%)\n`;
    }
    
    message += `\n🕒 *时间：* ${dateStr} (UTC+8)`;
    
    return message;
  }
  
  /**
   * 格式化批量交易
   */
  formatBatchTrades(trades) {
    const address = trades[0].address;
    const coin = trades[0].coin;
    
    // 统计数据
    let totalSize = 0;
    let totalPnl = 0;
    let totalValue = 0;
    let minPrice = Infinity;
    let maxPrice = 0;
    const directions = {};
    
    trades.forEach(trade => {
      const size = parseFloat(trade.size);
      const price = parseFloat(trade.price);
      
      totalSize += size;
      totalValue += size * price;
      
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
      
      if (trade.closedPnl) {
        totalPnl += parseFloat(trade.closedPnl);
      }
      directions[trade.direction] = (directions[trade.direction] || 0) + 1;
    });
    
    // 计算平均价格
    const avgPrice = (totalValue / totalSize).toFixed(2);
    
    // 获取主要方向
    const mainDirection = Object.keys(directions).reduce((a, b) => 
      directions[a] > directions[b] ? a : b
    );
    
    let actionEmoji = '';
    let actionText = '';
    
    if (mainDirection.includes('Open')) {
      if (mainDirection.includes('Long')) {
        actionEmoji = '🟢';
        actionText = '开多';
      } else {
        actionEmoji = '🔴';
        actionText = '开空';
      }
    } else if (mainDirection.includes('Close')) {
      if (mainDirection.includes('Long')) {
        actionEmoji = '🟡';
        actionText = '平多';
      } else {
        actionEmoji = '🟠';
        actionText = '平空';
      }
    }
    
    // 格式化时间（完整日期+时间）
    const date = new Date(trades[0].timestamp);
    const dateStr = date.toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // 构建方向统计
    let directionStats = '';
    for (const [dir, count] of Object.entries(directions)) {
      const dirEmoji = dir.includes('Long') ? (dir.includes('Open') ? '🟢' : '🟡') : (dir.includes('Open') ? '🔴' : '🟠');
      directionStats += `  ${dirEmoji} ${dir}: ${count}笔\n`;
    }
    
    // 构建消息
    let message = `🐋 *鲸鱼预警 (${trades.length}笔)*\n`;
    message += `${'='.repeat(32)}\n\n`;
    message += `👤 *地址*\n\`${address}\`\n\n`;
    message += `💱 *币种：* ${coin}\n`;
    message += `📈 *主要方向：* ${actionEmoji} ${actionText}\n\n`;
    
    message += `📊 *交易统计*\n`;
    message += directionStats;
    message += `\n💰 *价格区间*\n`;
    message += `  最低：$${minPrice.toFixed(2)}\n`;
    message += `  最高：$${maxPrice.toFixed(2)}\n`;
    message += `  平均：$${avgPrice}\n\n`;
    
    message += `📊 *总数量：* ${totalSize.toFixed(4)} ${coin}\n`;
    message += `💵 *总金额：* $${totalValue.toFixed(2)}\n`;
    
    if (totalPnl !== 0) {
      const pnlEmoji = totalPnl > 0 ? '💚' : '💔';
      const pnlPercent = ((totalPnl / totalValue) * 100).toFixed(2);
      message += `${pnlEmoji} *总盈亏：* ${totalPnl > 0 ? '+' : ''}$${totalPnl.toFixed(2)} (${totalPnl > 0 ? '+' : ''}${pnlPercent}%)\n`;
    }
    
    message += `\n🕒 *时间：* ${dateStr} (UTC+8)`;
    
    return message;
  }
  
  /**
   * 添加消息到队列
   */
  queueMessage(message, retryCount = 0) {
    this.messageQueue.push({ message, retryCount });
  }
  
  /**
   * 启动消息队列处理器
   */
  startQueueProcessor() {
    setInterval(async () => {
      if (this.isProcessingQueue || this.messageQueue.length === 0) {
        return;
      }
      
      this.isProcessingQueue = true;
      
      try {
        // 检查是否需要等待
        const now = Date.now();
        const timeSinceLastMessage = now - this.lastMessageTime;
        
        if (timeSinceLastMessage < this.minMessageInterval) {
          this.isProcessingQueue = false;
          return;
        }
        
        // 发送队列中的第一条消息
        const item = this.messageQueue.shift();
        
        try {
          await this.bot.sendMessage(this.channelId, item.message, { parse_mode: 'Markdown' });
          this.lastMessageTime = Date.now();
          console.log('✅ 已发送交易通知到频道');
        } catch (error) {
          if (error.response && error.response.statusCode === 429) {
            // 速率限制，重新加入队列
            const retryAfter = error.response.body.parameters?.retry_after || 5;
            console.log(`⚠️ 触发速率限制，${retryAfter}秒后重试...`);
            
            // 如果重试次数少于3次，重新加入队列
            if (item.retryCount < 3) {
              setTimeout(() => {
                this.queueMessage(item.message, item.retryCount + 1);
              }, retryAfter * 1000);
            } else {
              console.error('❌ 消息重试次数过多，已放弃');
            }
          } else {
            console.error('❌ 发送通知失败:', error.message);
          }
        }
      } finally {
        this.isProcessingQueue = false;
      }
    }, 500); // 每500ms检查一次队列
  }

  /**
   * 缩短地址显示
   */
  shortenAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * 发送测试消息
   */
  async sendTestMessage() {
    try {
      await this.bot.sendMessage(this.channelId, '✅ Bot 已启动，开始监听交易...');
      console.log('✅ 测试消息已发送');
    } catch (error) {
      console.error('❌ 发送测试消息失败:', error.message);
    }
  }

  /**
   * 事件发射器（用于与主程序通信）
   */
  emit(event, data) {
    if (this.eventHandlers && this.eventHandlers[event]) {
      this.eventHandlers[event](data);
    }
  }

  /**
   * 注册事件处理器
   */
  on(event, handler) {
    if (!this.eventHandlers) {
      this.eventHandlers = {};
    }
    this.eventHandlers[event] = handler;
  }

  /**
   * 停止 Bot
   */
  stop() {
    this.bot.stopPolling();
    console.log('🛑 Telegram Bot 已停止');
  }
}

module.exports = TelegramBotManager;
