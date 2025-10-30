/**
 * 初始管理员设置脚本
 * 用于在首次启动前添加管理员
 */

const DatabaseManager = require('./src/database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('🔧 Hyperliquid Monitor - 管理员设置工具\n');

  try {
    const db = new DatabaseManager();
    
    // 检查是否已有管理员
    const existingAdmins = db.getAllAdmins();
    
    if (existingAdmins.length > 0) {
      console.log('📋 当前管理员列表：');
      existingAdmins.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
      });
      console.log('');
    } else {
      console.log('ℹ️  当前没有管理员\n');
    }

    const action = await question('请选择操作 [1=添加管理员, 2=删除管理员, 3=退出]: ');

    if (action === '1') {
      // 添加管理员
      const userId = await question('请输入要添加的 Telegram User ID: ');
      
      if (!userId.trim()) {
        console.log('❌ User ID 不能为空');
        rl.close();
        return;
      }

      const success = db.addAdmin(userId.trim());
      if (success) {
        console.log(`✅ 已添加管理员: ${userId.trim()}`);
      } else {
        console.log('⚠️ 该用户已是管理员');
      }
    } else if (action === '2') {
      // 删除管理员
      if (existingAdmins.length === 0) {
        console.log('❌ 没有可删除的管理员');
        rl.close();
        return;
      }

      const userId = await question('请输入要删除的 Telegram User ID: ');
      
      if (!userId.trim()) {
        console.log('❌ User ID 不能为空');
        rl.close();
        return;
      }

      const success = db.removeAdmin(userId.trim());
      if (success) {
        console.log(`✅ 已删除管理员: ${userId.trim()}`);
      } else {
        console.log('⚠️ 该用户不是管理员');
      }
    } else {
      console.log('👋 再见！');
    }

    db.close();
    rl.close();

  } catch (error) {
    console.error('❌ 错误:', error.message);
    rl.close();
    process.exit(1);
  }
}

main();
