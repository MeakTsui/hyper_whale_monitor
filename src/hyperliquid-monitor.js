const WebSocket = require('ws');
const EventEmitter = require('events');

class HyperliquidMonitor extends EventEmitter {
  constructor(wsUrl, database) {
    super();
    this.wsUrl = wsUrl;
    this.ws = null;
    this.addresses = new Set();
    this.reconnectInterval = 5000;
    this.reconnectTimer = null;
    this.isConnecting = false;
    this.shouldReconnect = true;
    this.pingInterval = null;
    this.pongTimeout = null;
    this.db = database; // 数据库实例
    
    // 交易去重：内存缓存 + 数据库持久化
    this.processedTrades = new Map(); // key: tradeId, value: timestamp
    this.tradeIdTTL = 3600000; // 1小时后清理旧记录
    this.startTradeCleanup();
  }

  /**
   * 连接到 Hyperliquid WebSocket
   */
  async connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      console.log('🔌 正在连接 Hyperliquid WebSocket...');
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('✅ WebSocket 连接成功');
        this.isConnecting = false;
        this.emit('connected');
        
        // 设置 pong 监听器（只设置一次）
        this.setupPongListener();
        
        // 重新订阅所有地址
        this.resubscribeAll();
        
        // 启动心跳
        this.startHeartbeat();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        const now = new Date().toLocaleTimeString('zh-CN');
        console.error(`❌ [${now}] WebSocket 错误:`, error.message);
        this.emit('error', error);
      });

      this.ws.on('close', (code, reason) => {
        const now = new Date().toLocaleTimeString('zh-CN');
        console.log(`🔌 [${now}] WebSocket 连接关闭 (code: ${code}, reason: ${reason || '无'})`);
        this.isConnecting = false;
        this.stopHeartbeat();
        
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

    } catch (error) {
      console.error('❌ 连接失败:', error.message);
      this.isConnecting = false;
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * 设置 pong 监听器
   */
  setupPongListener() {
    if (this.ws) {
      this.ws.on('pong', () => {
        const now = new Date().toLocaleTimeString('zh-CN');
        console.log(`💓 [${now}] 收到 Pong 响应`);
        
        if (this.pongTimeout) {
          clearTimeout(this.pongTimeout);
          this.pongTimeout = null;
        }
      });
    }
  }
  
  /**
   * 启动心跳机制
   */
  startHeartbeat() {
    console.log('💓 启动心跳机制（30秒间隔）');
    
    // 每 30 秒发送一次 ping
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const now = new Date().toLocaleTimeString('zh-CN');
        console.log(`💓 [${now}] 发送 Ping...`);
        
        try {
          this.ws.ping();
          
          // 设置 pong 超时（10秒）
          this.pongTimeout = setTimeout(() => {
            const timeoutTime = new Date().toLocaleTimeString('zh-CN');
            console.log(`⚠️ [${timeoutTime}] Pong 超时（10秒无响应），强制重连...`);
            this.ws.terminate();
          }, 10000);
        } catch (error) {
          console.error('❌ 发送 Ping 失败:', error.message);
        }
      } else {
        const state = this.ws ? this.ws.readyState : 'null';
        console.log(`⚠️ WebSocket 状态异常，无法发送 Ping (state: ${state})`);
      }
    }, 50000);
  }

  /**
   * 停止心跳机制
   */
  stopHeartbeat() {
    console.log('💓 停止心跳机制');
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  /**
   * 安排重连
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    const now = new Date().toLocaleTimeString('zh-CN');
    console.log(`⏰ [${now}] ${this.reconnectInterval / 1000} 秒后尝试重连...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * 处理接收到的消息
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      // 处理订阅响应
      if (message.channel === 'subscriptionResponse') {
        console.log('📬 订阅响应:', message.data);
        return;
      }

      // 处理 userFills 事件（开仓/平仓）
      if (message.channel === 'userFills') {
        this.handleUserFills(message.data);
      }

      // 处理 userEvents 事件（资金费、强平等）
      if (message.channel === 'userEvents') {
        this.handleUserEvents(message.data);
      }

      // 处理 userNonFundingLedgerUpdates 事件
      if (message.channel === 'userNonFundingLedgerUpdates') {
        this.handleLedgerUpdates(message.data);
      }

    } catch (error) {
      console.error('❌ 解析消息失败:', error.message);
    }
  }

  /**
   * 处理用户成交事件
   */
  handleUserFills(data) {
    if (!data || !data.fills) return;

    data.fills.forEach(fill => {
      // 生成唯一交易ID（地址+币种+时间戳+价格+数量）
      const tradeId = `${data.user}_${fill.coin}_${fill.time}_${fill.px}_${fill.sz}`;
      
      // 先检查内存缓存
      if (this.processedTrades.has(tradeId)) {
        console.log('⏭️  跳过重复交易(内存):', tradeId.substring(0, 50) + '...');
        return;
      }
      
      // 再检查数据库
      if (this.db && this.db.isTradeProcessed(tradeId)) {
        console.log('⏭️  跳过重复交易(数据库):', tradeId.substring(0, 50) + '...');
        // 添加到内存缓存
        this.processedTrades.set(tradeId, Date.now());
        return;
      }
      
      // 记录到内存缓存
      this.processedTrades.set(tradeId, Date.now());
      
      // 持久化到数据库
      if (this.db) {
        this.db.addProcessedTrade(tradeId, data.user, fill.coin, fill.time);
      }
      
      const tradeInfo = {
        address: data.user,
        coin: fill.coin,
        side: fill.side, // buy 或 sell
        price: fill.px,
        size: fill.sz,
        timestamp: fill.time,
        direction: fill.dir, // Open Long, Close Long, Open Short, Close Short
        closedPnl: fill.closedPnl || '0'
      };

      console.log('📊 捕获交易:', tradeInfo);
      this.emit('trade', tradeInfo);
    });
  }

  /**
   * 处理用户事件（资金费、强平等）
   */
  handleUserEvents(data) {
    if (!data || !data.events) return;

    data.events.forEach(event => {
      console.log('📢 用户事件:', event);
      this.emit('userEvent', {
        address: data.user,
        event: event
      });
    });
  }

  /**
   * 处理账本更新
   */
  handleLedgerUpdates(data) {
    if (!data || !data.updates) return;

    console.log('💰 账本更新:', data);
    this.emit('ledgerUpdate', data);
  }

  /**
   * 订阅地址
   */
  subscribe(address) {
    if (!address) return;

    this.addresses.add(address);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // 订阅 userFills
      this.ws.send(JSON.stringify({
        method: 'subscribe',
        subscription: {
          type: 'userFills',
          user: address,
          aggregateByTime: true
        }
      }));

      // 订阅 userEvents
      this.ws.send(JSON.stringify({
        method: 'subscribe',
        subscription: {
          type: 'userEvents',
          user: address
        }
      }));

      // 订阅 userNonFundingLedgerUpdates
      this.ws.send(JSON.stringify({
        method: 'subscribe',
        subscription: {
          type: 'userNonFundingLedgerUpdates',
          user: address
        }
      }));

      console.log(`✅ 已订阅地址: ${address}`);
    }
  }

  /**
   * 取消订阅地址
   */
  unsubscribe(address) {
    if (!address) return;

    this.addresses.delete(address);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // 取消订阅 userFills
      this.ws.send(JSON.stringify({
        method: 'unsubscribe',
        subscription: {
          type: 'userFills',
          user: address
        }
      }));

      // 取消订阅 userEvents
      this.ws.send(JSON.stringify({
        method: 'unsubscribe',
        subscription: {
          type: 'userEvents',
          user: address
        }
      }));

      // 取消订阅 userNonFundingLedgerUpdates
      this.ws.send(JSON.stringify({
        method: 'unsubscribe',
        subscription: {
          type: 'userNonFundingLedgerUpdates',
          user: address
        }
      }));

      console.log(`✅ 已取消订阅地址: ${address}`);
    }
  }

  /**
   * 重新订阅所有地址
   */
  resubscribeAll() {
    console.log(`🔄 重新订阅 ${this.addresses.size} 个地址...`);
    this.addresses.forEach(address => {
      this.subscribe(address);
    });
  }

  /**
   * 获取当前订阅的地址列表
   */
  getAddresses() {
    return Array.from(this.addresses);
  }

  /**
   * 启动交易记录清理定时器
   */
  startTradeCleanup() {
    // 每10分钟清理一次内存中过期的交易记录
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const [tradeId, timestamp] of this.processedTrades.entries()) {
        if (now - timestamp > this.tradeIdTTL) {
          this.processedTrades.delete(tradeId);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 清理了 ${cleanedCount} 条内存中的过期交易记录`);
      }
    }, 600000); // 10分钟
    
    // 每天清理一次数据库中的过期记录（保留7天）
    setInterval(() => {
      if (this.db) {
        const deleted = this.db.cleanOldTrades(7);
        if (deleted > 0) {
          console.log(`🧹 清理了 ${deleted} 条数据库中的过期交易记录（>7天）`);
        }
        
        // 显示统计信息
        const stats = this.db.getTradeStats();
        console.log(`📊 交易记录统计: 总计 ${stats.total} 条, 最早 ${stats.oldest}, 最新 ${stats.newest}`);
      }
    }, 86400000); // 24小时
  }
  
  /**
   * 断开连接
   */
  disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    console.log('🔌 已断开 WebSocket 连接');
  }
}

module.exports = HyperliquidMonitor;
