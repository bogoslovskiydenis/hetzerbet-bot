import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import './src/config/firebase.js';
import { database } from './src//config/services/database.js';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// ========== ТЕСТИРОВАНИЕ FIREBASE ==========
(async () => {
    console.log('\n🔥 Testing Firebase connection...');
    const testResult = await database.testConnection();
    if (testResult) {
        console.log('✅ Firebase is ready to use!\n');
    } else {
        console.log('❌ Firebase connection failed. Check your credentials.\n');
        process.exit(1);
    }
})();

// ========== TELEGRAM BOT ==========

// Команда /start с сохранением в БД
bot.command('start', async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username;
    const firstName = ctx.from.first_name;

    console.log(`\n👤 User ${userId} (@${username}) started the bot`);

    let user = await database.getUser(userId);

    if (!user) {
        console.log(`📝 Creating new user ${userId}...`);
        await database.createUser(userId, {
            username,
            first_name: firstName,
            language: 'en',
        });
        await ctx.reply('👋 Welcome! You have been registered in our database.');
    } else {
        await ctx.reply(`👋 Welcome back, ${firstName}!`);
    }

    user = await database.getUser(userId);
    console.log('User data:', user);
});

// Команда /mydata - показать данные из БД
bot.command('mydata', async (ctx) => {
    const userId = ctx.from.id;
    const user = await database.getUser(userId);

    if (user) {
        const message = `
📊 Your Data:

🆔 User ID: ${user.user_id}
👤 Username: @${user.username || 'N/A'}
📝 First Name: ${user.first_name}
🌐 Language: ${user.language}
📅 Registered: ${user.registration_date?.toDate().toLocaleString() || 'N/A'}
    `.trim();

        await ctx.reply(message);
    } else {
        await ctx.reply('❌ User not found. Use /start to register.');
    }
});

// Команда /test - тест Firebase
bot.command('test', async (ctx) => {
    await ctx.reply('🔥 Testing Firebase connection...');
    const result = await database.testConnection();

    if (result) {
        await ctx.reply('✅ Firebase is working!');
    } else {
        await ctx.reply('❌ Firebase connection failed.');
    }
});

// Эхо для любого текста
bot.on('text', async (ctx) => {
    await ctx.reply(`Echo: ${ctx.message.text}`);
});

