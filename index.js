import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import './src/config/firebase.js';
import { database } from './src/config/services/database.js';
import { t } from './src/locales/i18n.js';
import {
    getMainKeyboard,
    getLanguageKeyboard
} from './src/utils/keyboards.js';

// Импорт админ-обработчиков
import { registerAdminHandlers } from './src/handlers/admin/index.js';
import { registerStatisticsHandlers } from './src/handlers/admin/statistics.js';
import { registerBroadcastHandlers } from './src/handlers/admin/broadcast.js';
import { registerExportHandlers } from './src/handlers/admin/export.js';
import { registerSettingsHandlers } from './src/handlers/admin/settings.js';

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

// ========== HELPER FUNCTIONS ==========

async function getUserLanguage(userId) {
    const user = await database.getUser(userId);
    return user?.language || 'en';
}

// ========== TELEGRAM BOT ==========

// Команда /start с выбором языка
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
        });

        const languageKeyboard = getLanguageKeyboard();
        await ctx.reply(
            t('welcome.choose_language', 'en'),
            languageKeyboard
        );
    } else {
        const lang = user.language || 'en';

        if (!user.language) {
            const languageKeyboard = getLanguageKeyboard();
            await ctx.reply(
                t('welcome.choose_language', 'en'),
                languageKeyboard
            );
        } else {
            await ctx.reply(
                t('main.welcome_text', lang),
                getMainKeyboard(lang)
            );
        }
    }
});

// Обработка выбора языка
bot.action(/language_(de|en)/, async (ctx) => {
    const userId = ctx.from.id;
    const language = ctx.match[1];

    console.log(`🌐 User ${userId} selected language: ${language}`);

    await database.updateUser(userId, {
        language,
        onboarding_step: 'channel_subscription'
    });

    await ctx.answerCbQuery();
    await ctx.editMessageText(t('welcome.language_selected', language));

    // TODO: Здесь будет логика проверки подписки
    // Пока показываем основное меню
    setTimeout(async () => {
        await ctx.reply(
            t('main.welcome_text', language),
            getMainKeyboard(language)
        );
    }, 1000);
});

// Команда /language - смена языка
bot.command('language', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    const languageKeyboard = getLanguageKeyboard();
    await ctx.reply(
        t('welcome.choose_language', lang),
        languageKeyboard
    );
});

// Команда /help
bot.command('help', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.reply(t('commands.help_text', lang));
});

// Команда /unsubscribe - отключение уведомлений
bot.command('unsubscribe', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback(t('commands.button_yes', lang), 'unsubscribe_yes'),
            Markup.button.callback(t('commands.button_no', lang), 'unsubscribe_no')
        ]
    ]);

    await ctx.reply(t('commands.unsubscribe_confirm', lang), keyboard);
});

// Обработка подтверждения отписки
bot.action('unsubscribe_yes', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await database.updateUser(userId, { notifications_enabled: false });

    await ctx.answerCbQuery();
    await ctx.editMessageText(t('commands.unsubscribe_success', lang));
});

bot.action('unsubscribe_no', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();
    await ctx.editMessageText(t('commands.unsubscribe_cancelled', lang));
});

// ========== РЕГИСТРАЦИЯ АДМИН-ОБРАБОТЧИКОВ ==========
registerAdminHandlers(bot);
registerStatisticsHandlers(bot);
registerBroadcastHandlers(bot);
registerExportHandlers(bot);
registerSettingsHandlers(bot);

// ========== ЭХО-ФУНКЦИЯ ==========
// Обработка всех остальных текстовых сообщений
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    // Обновляем последнюю активность
    await database.updateUser(userId, {});

    // Отправляем приветственное сообщение с кнопками
    await ctx.reply(
        t('main.welcome_text', lang),
        getMainKeyboard(lang)
    );
});

// ========== ОБРАБОТКА ОШИБОК ==========
bot.catch((err, ctx) => {
    console.error('❌ Bot error:', err);
    const userId = ctx.from?.id;

    if (userId) {
        getUserLanguage(userId).then(lang => {
            ctx.reply(t('errors.general', lang)).catch(console.error);
        });
    }
});

// ========== ЗАПУСК БОТА ==========
console.log('🤖 Starting Telegram bot...');

bot.launch({
    dropPendingUpdates: true
}).then(() => {
    console.log('✅ Bot started successfully!');
    console.log('🔗 Bot username: @' + bot.botInfo.username);
    console.log('\n📊 Admin Panel: /admin');
    console.log('🌐 Change Language: /language');
    console.log('❓ Help: /help');
});

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('\n⚠️ SIGINT received, stopping bot...');
    bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
    console.log('\n⚠️ SIGTERM received, stopping bot...');
    bot.stop('SIGTERM');
});

// Специальная команда для первичной инициализации админа
// ВАЖНО: Удалите эту команду после настройки или добавьте дополнительную защиту!
bot.command('makeadmin', async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username;

    console.log(`\n🔐 Make admin request:`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Username: @${username}`);

    // ВАЖНО: Укажите здесь ID того, кто может стать первым админом
    const ALLOWED_INIT_IDS = [5230934145, 1099861998];

    if (!ALLOWED_INIT_IDS.includes(userId)) {
        console.log(`   ❌ User ${userId} is not in allowed list`);
        await ctx.reply('❌ Access denied. This command is restricted.');
        return;
    }

    try {
        // Получаем текущие настройки
        let settings = await database.getBotSettings();

        if (!settings) {
            console.log('   Creating default settings...');
            await database.createDefaultSettings();
            settings = await database.getBotSettings();
        }

        // Добавляем пользователя в админы
        const currentAdmins = settings.admin_ids || [];

        if (currentAdmins.includes(userId)) {
            await ctx.reply('✅ You are already an admin!');
            console.log(`   ℹ️  User ${userId} is already admin`);
            return;
        }

        currentAdmins.push(userId);

        await database.updateSettings({
            admin_ids: currentAdmins
        });

        await ctx.reply(
            '✅ Admin access granted!\n\n' +
            'You can now use /admin command.\n\n' +
            '⚠️ For security, consider removing /makeadmin command from the code.'
        );

        console.log(`   ✅ User ${userId} (@${username}) added as admin`);
        console.log(`   Current admins: ${currentAdmins.join(', ')}`);

    } catch (error) {
        console.error('   ❌ Error adding admin:', error);
        await ctx.reply('❌ Error occurred. Check the logs.');
    }
});