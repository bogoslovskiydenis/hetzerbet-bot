import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import './src/config/firebase.js';
import { database } from './src/config/services/database.js';
import { t } from './src/locales/i18n.js';
import {
    getMainKeyboard,
    getLanguageKeyboard
} from './src/utils/keyboards.js';
import { sendWelcomeMessageWithImage } from './src/utils/welcome.js';

// Импорт обработчиков
import { registerAdminHandlers } from './src/handlers/admin/index.js';
import { registerStatisticsHandlers } from './src/handlers/admin/statistics.js';
import {
    registerBroadcastHandlers,
    handleBroadcastText,
    handleBroadcastButtons,
    handleDateTimeInput
} from './src/handlers/admin/broadcast.js';
import { registerExportHandlers } from './src/handlers/admin/export.js';
import { registerSettingsHandlers, handleNotificationIntervalInput, handleNotificationIntervalMinutesInput } from './src/handlers/admin/settings.js';
import { registerNotificationHandlers, handleNotificationInput } from './src/handlers/admin/notifications.js';
import {
    shouldRequestPhone,
    requestPhoneNumber,
    handlePhoneContact,
    handlePhoneSkip,
    isAwaitingPhone
} from './src/handlers/phone.js';

// ⭐ ДОБАВЛЕНО: Импорт планировщиков
import { startNotificationScheduler } from './src/services/notifications.js';
import { startBroadcastScheduler } from './src/services/broadcastScheduler.js';
import { broadcastStates } from './src/utils/broadcastStates.js';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Делаем бот доступным глобально для перезапуска планировщиков
global.bot = bot;

// ========== HELPER FUNCTIONS ==========

async function getUserLanguage(userId) {
    const user = await database.getUser(userId);
    return user?.language || 'en';
}

// Вспомогательная функция для отправки приветственного сообщения (с обновлением onboarding)
async function sendWelcomeMessage(ctx, language) {
    await database.updateUser(ctx.from.id, {
        onboarding_step: 'completed',
        onboarding_completed: true
    });

    await sendWelcomeMessageWithImage(ctx, language);
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
        console.log(`🆕 Creating new user ${userId}...`);
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
            await sendWelcomeMessageWithImage(ctx, lang);
        }
    }
});

// Обработка выбора языка
bot.action(/language_(de|en)/, async (ctx) => {
    const userId = ctx.from.id;
    const language = ctx.match[1];

    console.log(`🌍 User ${userId} selected language: ${language}`);

    await database.updateUser(userId, {
        language,
        onboarding_step: 'language_selected'
    });

    await ctx.answerCbQuery();
    
    // Удаляем сообщение с выбором языка
    try {
        await ctx.deleteMessage();
    } catch (error) {
        console.log('Could not delete message (might be too old)');
    }

    // Проверяем, нужно ли запрашивать номер телефона
    const phoneRequired = await shouldRequestPhone();

    if (phoneRequired) {
        console.log(`📱 Phone request is enabled, showing phone keyboard`);
        await requestPhoneNumber(ctx, language);
    } else {
        console.log(`⭐️ Phone request is disabled, showing welcome message`);
        await sendWelcomeMessage(ctx, language);
    }
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
registerNotificationHandlers(bot);
registerExportHandlers(bot);
registerSettingsHandlers(bot);

// ========== ОБРАБОТКА КОНТАКТОВ И ТЕКСТА ==========

// Обработка контакта (номер телефона)
bot.on('contact', async (ctx) => {
    await handlePhoneContact(ctx);
});

// Обработка всех остальных текстовых сообщений
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const text = ctx.message.text;

    // Проверяем, является ли пользователь админом
    const isAdmin = await database.isAdmin(userId);

    // Если админ ожидает ввод интервала уведомлений
    if (isAdmin) {
        const user = await database.getUser(userId);
        if (user?.awaiting_input === 'notification_interval') {
            await handleNotificationIntervalInput(ctx, text);
            return;
        }
        
        // Если админ ожидает ввод интервала в минутах
        if (user?.awaiting_input === 'notification_interval_minutes') {
            await handleNotificationIntervalMinutesInput(ctx, text);
            return;
        }
        
        // Если админ ожидает ввод данных для уведомлений
        if (user?.awaiting_input?.startsWith('notification_')) {
            await handleNotificationInput(ctx, text);
            return;
        }
    }

    // Если админ в процессе создания рассылки
    if (isAdmin && broadcastStates.isActive(userId)) {
        // Проверка на команду отмены
        if (text === '/cancel') {
            await handleBroadcastText(ctx);
            return;
        }

        // Если ожидается текст рассылки
        if (broadcastStates.isAwaitingText(userId)) {
            await handleBroadcastText(ctx);
            return;
        }

        // Если ожидаются кнопки (текст содержит "|")
        if (broadcastStates.isAwaitingButtons(userId)) {
            await handleBroadcastButtons(ctx);
            return;
        }

        // ⭐ ДОБАВЛЕНО: Если ожидается дата/время
        if (broadcastStates.isAwaitingDateTime(userId)) {
            await handleDateTimeInput(ctx);
            return;
        }
    }

    // Проверяем, ждет ли бот номер телефона
    const awaitingPhone = await isAwaitingPhone(userId);

    if (awaitingPhone) {
        // Проверяем, не нажал ли пользователь "Пропустить"
        const skipped = await handlePhoneSkip(ctx);
        if (skipped) {
            return;
        }
    }

    // Обновляем последнюю активность
    await database.updateUser(userId, {});

    // Отправляем приветственное сообщение с изображением и кнопками (эхо-функция)
    await sendWelcomeMessageWithImage(ctx, lang);
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
});

// Ждём небольшую задержку и запускаем планировщики
setTimeout(() => {
    if (bot.botInfo) {
        console.log('✅ Bot started successfully!');
        console.log('🔗 Bot username: @' + bot.botInfo.username);
        console.log('\n📊 Admin Panel: /admin');
        console.log('🌍 Change Language: /language');
        console.log('❓ Help: /help');
        console.log('📱 Phone Request: configurable in /admin');

        console.log('\n🔧 Starting notification scheduler...');
        startNotificationScheduler(bot);

        console.log('📅 Starting broadcast scheduler...');
        startBroadcastScheduler(bot);
    } else {
        console.log('⚠️ Bot not ready yet, retrying...');
        setTimeout(() => {
            console.log('✅ Bot started successfully!');
            console.log('🔗 Bot username: @' + bot.botInfo.username);
            startNotificationScheduler(bot);
            startBroadcastScheduler(bot);
        }, 2000);
    }
}, 2000);

bot.command('enablenotifications', async (ctx) => {
    const userId = ctx.from.id;
    await database.updateUser(userId, { notifications_enabled: true });
    await ctx.reply('✅ Notifications enabled for testing!');
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