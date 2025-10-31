const axios = require('axios');

class ApiClient {
  constructor(webhookUrl, enabled = false) {
    this.webhookUrl = webhookUrl;
    this.enabled = enabled;
    this.requestQueue = [];
    this.isProcessing = false;
    this.retryDelay = 1000; // 重试延迟 1 秒
    this.maxRetries = 3; // 最大重试次数
    
    if (this.enabled && this.webhookUrl) {
      console.log(`✅ API Webhook 已启用: ${this.webhookUrl}`);
      this.startQueueProcessor();
    } else {
      console.log('ℹ️  API Webhook 未启用');
    }
  }

  /**
   * 解析交易方向
   * @param {string} direction - 交易方向 (Open Long, Close Long, Open Short, Close Short)
   * @returns {Object} { action: 'open|close', side: 'long|short' }
   */
  parseDirection(direction) {
    const isOpen = direction.includes('Open');
    const isLong = direction.includes('Long');
    
    return {
      action: isOpen ? 'open' : 'close',
      side: isLong ? 'long' : 'short'
    };
  }

  /**
   * 发送交易信号
   * @param {Object} tradeInfo - 交易信息
   */
  async sendTradeSignal(tradeInfo) {
    if (!this.enabled || !this.webhookUrl) {
      return;
    }

    const { action, side } = this.parseDirection(tradeInfo.direction);
    
    const payload = {
      type: "3",
      symbol: tradeInfo.coin,
      action: action,
      side: side
    };

    // 添加到队列
    this.requestQueue.push({
      payload,
      tradeInfo,
      retryCount: 0
    });
  }

  /**
   * 启动请求队列处理器
   */
  startQueueProcessor() {
    setInterval(async () => {
      if (this.isProcessing || this.requestQueue.length === 0) {
        return;
      }

      this.isProcessing = true;

      try {
        const item = this.requestQueue.shift();
        await this.sendRequest(item);
      } catch (error) {
        console.error('❌ API 请求处理失败:', error.message);
      } finally {
        this.isProcessing = false;
      }
    }, 500); // 每 500ms 处理一次
  }

  /**
   * 发送 HTTP 请求
   * @param {Object} item - 请求项
   */
  async sendRequest(item) {
    const { payload, tradeInfo, retryCount } = item;

    try {
      const now = new Date().toLocaleTimeString('zh-CN');
      console.log(`📤 [${now}] 发送交易信号到 API:`, JSON.stringify(payload));

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 秒超时
      });

      console.log(`✅ [${now}] API 响应成功:`, response.status, response.data);

    } catch (error) {
      const now = new Date().toLocaleTimeString('zh-CN');
      
      if (error.code === 'ECONNREFUSED') {
        console.error(`❌ [${now}] API 连接被拒绝: ${this.webhookUrl}`);
      } else if (error.code === 'ETIMEDOUT') {
        console.error(`❌ [${now}] API 请求超时`);
      } else if (error.response) {
        console.error(`❌ [${now}] API 响应错误:`, error.response.status, error.response.data);
      } else {
        console.error(`❌ [${now}] API 请求失败:`, error.message);
      }

      // 重试机制
      if (retryCount < this.maxRetries) {
        console.log(`🔄 [${now}] 将在 ${this.retryDelay / 1000} 秒后重试 (${retryCount + 1}/${this.maxRetries})`);
        
        setTimeout(() => {
          this.requestQueue.push({
            payload,
            tradeInfo,
            retryCount: retryCount + 1
          });
        }, this.retryDelay);
      } else {
        console.error(`❌ [${now}] 达到最大重试次数，放弃发送`);
      }
    }
  }

  /**
   * 测试连接
   */
  async testConnection() {
    if (!this.enabled || !this.webhookUrl) {
      console.log('ℹ️  API Webhook 未启用，跳过测试');
      return false;
    }

    try {
      console.log(`🔍 测试 API 连接: ${this.webhookUrl}`);
      
      const testPayload = {
        type: "3",
        symbol: "BTC",
        action: "open",
        side: "long"
      };

      const response = await axios.post(this.webhookUrl, testPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      console.log(`✅ API 连接测试成功:`, response.status);
      return true;

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.error(`❌ API 连接测试失败: 连接被拒绝 (${this.webhookUrl})`);
      } else if (error.code === 'ETIMEDOUT') {
        console.error(`❌ API 连接测试失败: 请求超时`);
      } else if (error.response) {
        console.error(`❌ API 连接测试失败: HTTP ${error.response.status}`);
      } else {
        console.error(`❌ API 连接测试失败:`, error.message);
      }
      return false;
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      enabled: this.enabled,
      webhookUrl: this.webhookUrl,
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessing
    };
  }
}

module.exports = ApiClient;
