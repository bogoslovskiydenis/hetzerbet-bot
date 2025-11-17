// Скрипт для получения chat_id канала или группы
// Запустите: node get-chat-id.js

import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

console.log('🤖 Запуск бота для получения chat_id...\n');
console.log('📋 Инструкция:');
console.log('1. Добавьте бота в канал/группу как администратора');
console.log('2. Перешлите любое сообщение из канала/группы боту в личные сообщения');
console.log('3. Или напишите что-то в канал/группу где бот админ\n');
console.log('⏳ Ожидаю сообщений...\n');

// Обработка всех обновлений
bot.on('message', (ctx) => {
    const message = ctx.message;
    
    console.log('📨 Получено сообщение:');
    console.log('─'.repeat(50));
    
    // Если сообщение переслано из канала/группы
    if (message.forward_from_chat) {
        const chat = message.forward_from_chat;
        console.log('✅ Найден чат (переслано из):');
        console.log(`   Тип: ${chat.type}`);
        console.log(`   Название: ${chat.title || 'N/A'}`);
        console.log(`   Username: ${chat.username ? '@' + chat.username : 'Приватный (нет username)'}`);
        console.log(`   \x1b[32m🎯 Chat ID: ${chat.id}\x1b[0m`);
        console.log('\n📝 Добавьте в .env:');
        if (chat.username) {
            console.log(`   \x1b[32mВАРИАНТ 1 (рекомендуется):\x1b[0m`);
            console.log(`   REQUIRED_CHANNEL=@${chat.username}`);
            console.log(`\n   \x1b[33mВАРИАНТ 2:\x1b[0m`);
            console.log(`   REQUIRED_CHANNEL=${chat.id}`);
        } else {
            console.log(`   REQUIRED_CHANNEL=${chat.id}`);
        }
    } 
    // Если сообщение из канала/группы напрямую
    else if (message.chat.type === 'channel' || message.chat.type === 'supergroup' || message.chat.type === 'group') {
        const chat = message.chat;
        console.log('✅ Найден чат (прямое сообщение):');
        console.log(`   Тип: ${chat.type}`);
        console.log(`   Название: ${chat.title || 'N/A'}`);
        console.log(`   Username: ${chat.username ? '@' + chat.username : 'Приватный (нет username)'}`);
        console.log(`   \x1b[32m🎯 Chat ID: ${chat.id}\x1b[0m`);
        console.log('\n📝 Добавьте в .env:');
        if (chat.username) {
            console.log(`   \x1b[32mВАРИАНТ 1 (рекомендуется):\x1b[0m`);
            console.log(`   REQUIRED_CHANNEL=@${chat.username}`);
            console.log(`\n   \x1b[33mВАРИАНТ 2:\x1b[0m`);
            console.log(`   REQUIRED_CHANNEL=${chat.id}`);
        } else {
            console.log(`   REQUIRED_CHANNEL=${chat.id}`);
        }
    }
    // Если это личное сообщение
    else {
        console.log('ℹ️  Это личное сообщение от пользователя');
        console.log('   Перешлите сообщение из канала/группы чтобы получить chat_id');
    }
    
    console.log('─'.repeat(50) + '\n');
});

bot.launch({
    dropPendingUpdates: true
});

console.log('✅ Бот запущен и ожидает сообщений...');
console.log('⚠️  Нажмите Ctrl+C для остановки\n');

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('\n👋 Остановка бота...');
    bot.stop('SIGINT');
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('\n👋 Остановка бота...');
    bot.stop('SIGTERM');
    process.exit(0);
});

