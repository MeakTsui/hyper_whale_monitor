const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
  constructor(dbPath = './data/monitor.db') {
    // 确保数据目录存在
    const fs = require('fs');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  /**
   * 初始化数据库表
   */
  initTables() {
    // 监听地址表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 管理员表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 已处理交易表（用于去重）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processed_trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trade_id TEXT UNIQUE NOT NULL,
        address TEXT NOT NULL,
        coin TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引以提高查询性能
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_trade_id ON processed_trades(trade_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON processed_trades(timestamp);
    `);

    console.log('✅ 数据库表初始化完成');
  }

  // ==================== 地址管理 ====================

  /**
   * 添加监听地址
   * @param {string} address - 钱包地址
   * @returns {boolean} 是否添加成功
   */
  addAddress(address) {
    try {
      const stmt = this.db.prepare('INSERT INTO addresses (address) VALUES (?)');
      stmt.run(address);
      return true;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        return false; // 地址已存在
      }
      throw error;
    }
  }

  /**
   * 删除监听地址
   * @param {string} address - 钱包地址
   * @returns {boolean} 是否删除成功
   */
  removeAddress(address) {
    const stmt = this.db.prepare('DELETE FROM addresses WHERE address = ?');
    const result = stmt.run(address);
    return result.changes > 0;
  }

  /**
   * 获取所有监听地址
   * @returns {Array<string>} 地址列表
   */
  getAllAddresses() {
    const stmt = this.db.prepare('SELECT address FROM addresses ORDER BY created_at DESC');
    const rows = stmt.all();
    return rows.map(row => row.address);
  }

  /**
   * 检查地址是否存在
   * @param {string} address - 钱包地址
   * @returns {boolean}
   */
  hasAddress(address) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM addresses WHERE address = ?');
    const result = stmt.get(address);
    return result.count > 0;
  }

  // ==================== 管理员管理 ====================

  /**
   * 添加管理员
   * @param {string} userId - Telegram 用户 ID
   * @returns {boolean} 是否添加成功
   */
  addAdmin(userId) {
    try {
      const stmt = this.db.prepare('INSERT INTO admins (user_id) VALUES (?)');
      stmt.run(userId.toString());
      return true;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        return false; // 管理员已存在
      }
      throw error;
    }
  }

  /**
   * 删除管理员
   * @param {string} userId - Telegram 用户 ID
   * @returns {boolean} 是否删除成功
   */
  removeAdmin(userId) {
    const stmt = this.db.prepare('DELETE FROM admins WHERE user_id = ?');
    const result = stmt.run(userId.toString());
    return result.changes > 0;
  }

  /**
   * 获取所有管理员
   * @returns {Array<string>} 管理员 ID 列表
   */
  getAllAdmins() {
    const stmt = this.db.prepare('SELECT user_id FROM admins ORDER BY created_at ASC');
    const rows = stmt.all();
    return rows.map(row => row.user_id);
  }

  /**
   * 检查是否为管理员
   * @param {string} userId - Telegram 用户 ID
   * @returns {boolean}
   */
  isAdmin(userId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM admins WHERE user_id = ?');
    const result = stmt.get(userId.toString());
    return result.count > 0;
  }

  // ==================== 交易记录管理 ====================

  /**
   * 检查交易是否已处理
   * @param {string} tradeId - 交易唯一ID
   * @returns {boolean}
   */
  isTradeProcessed(tradeId) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM processed_trades WHERE trade_id = ?');
    const result = stmt.get(tradeId);
    return result.count > 0;
  }

  /**
   * 记录已处理的交易
   * @param {string} tradeId - 交易唯一ID
   * @param {string} address - 地址
   * @param {string} coin - 币种
   * @param {number} timestamp - 时间戳
   * @returns {boolean}
   */
  addProcessedTrade(tradeId, address, coin, timestamp) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO processed_trades (trade_id, address, coin, timestamp)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(tradeId, address, coin, timestamp);
      return result.changes > 0;
    } catch (error) {
      console.error('❌ 记录交易失败:', error.message);
      return false;
    }
  }

  /**
   * 批量记录已处理的交易
   * @param {Array} trades - 交易数组 [{tradeId, address, coin, timestamp}]
   * @returns {number} 成功记录的数量
   */
  addProcessedTrades(trades) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO processed_trades (trade_id, address, coin, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    
    const insertMany = this.db.transaction((trades) => {
      let count = 0;
      for (const trade of trades) {
        const result = stmt.run(trade.tradeId, trade.address, trade.coin, trade.timestamp);
        count += result.changes;
      }
      return count;
    });
    
    return insertMany(trades);
  }

  /**
   * 清理过期的交易记录（保留最近N天）
   * @param {number} days - 保留天数，默认7天
   * @returns {number} 删除的记录数
   */
  cleanOldTrades(days = 7) {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const stmt = this.db.prepare('DELETE FROM processed_trades WHERE timestamp < ?');
    const result = stmt.run(cutoffTime);
    return result.changes;
  }

  /**
   * 获取已处理交易的统计信息
   * @returns {Object}
   */
  getTradeStats() {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as total FROM processed_trades');
    const total = totalStmt.get().total;
    
    const oldestStmt = this.db.prepare('SELECT MIN(timestamp) as oldest FROM processed_trades');
    const oldest = oldestStmt.get().oldest;
    
    const newestStmt = this.db.prepare('SELECT MAX(timestamp) as newest FROM processed_trades');
    const newest = newestStmt.get().newest;
    
    return {
      total,
      oldest: oldest ? new Date(oldest).toLocaleString('zh-CN') : null,
      newest: newest ? new Date(newest).toLocaleString('zh-CN') : null
    };
  }

  /**
   * 关闭数据库连接
   */
  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;
