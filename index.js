import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import './src/config/firebase.js';
import { database } from './src/config/services/database.js';
import { t } from './src/locales/i18n.js';

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

// Получить язык пользователя или язык по умолчанию
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

    // Если пользователь новый - создаем и показываем выбор языка
    if (!user) {
        console.log(`📝 Creating new user ${userId}...`);
        await database.createUser(userId, {
            username,
            first_name: firstName,
        });

        // Показываем выбор языка
        const languageKeyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('🇩🇪 Deutsch', 'language_de'),
                Markup.button.callback('🇬🇧 English', 'language_en')
            ]
        ]);

        await ctx.reply(
            t('welcome.choose_language', 'en'),
            languageKeyboard
        );
    } else {
        // Если пользователь уже существует
        const lang = user.language || 'en';

        if (!user.language) {
            // Если язык не установлен - показываем выбор языка
            const languageKeyboard = Markup.inlineKeyboard([
                [
                    Markup.button.callback('🇩🇪 Deutsch', 'language_de'),
                    Markup.button.callback('🇬🇧 English', 'language_en')
                ]
            ]);

            await ctx.reply(
                t('welcome.choose_language', 'en'),
                languageKeyboard
            );
        } else {
            // Приветствие для вернувшегося пользователя
            await ctx.reply(t('main.welcome_text', lang), getMainKeyboard(lang));
        }
    }
});

// Обработка выбора языка
bot.action(/language_(de|en)/, async (ctx) => {
    const userId = ctx.from.id;
    const language = ctx.match[1]; // 'de' или 'en'

    console.log(`🌍 User ${userId} selected language: ${language}`);

    // Обновляем язык в БД
    await database.updateUser(userId, {
        language,
        onboarding_step: 'channel_subscription'
    });

    // Подтверждаем выбор языка
    await ctx.answerCbQuery();
    await ctx.editMessageText(t('welcome.language_selected', language));

    // Переходим к проверке подписки на канал
    // TODO: Здесь будет логика проверки подписки
    // Пока показываем основное меню
    setTimeout(async () => {
        await ctx.reply(
            t('main.welcome_text', language),
            getMainKeyboard(language)
        );
    }, 1000);
});

// Функция для получения основной клавиатуры
function getMainKeyboard(language) {
    return Markup.inlineKeyboard([
        [Markup.button.webApp(
            t('main.button_play_bot', language),
            process.env.MINI_APP_URL || 'https://hertzbet.com/mini-app'
        )],
        [Markup.button.url(
            t('main.button_play_web', language),
            process.env.WEBSITE_URL || 'https://hertzbet.com/register'
        )],
        [Markup.button.switchToChat(
            t('main.button_share', language),
            'Check out this amazing casino bot! 🎰'
        )]
    ]);
}


// Команда /language - смена языка
bot.command('language', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    const languageKeyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('🇩🇪 Deutsch', 'language_de'),
            Markup.button.callback('🇬🇧 English', 'language_en')
        ]
    ]);

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


// Команда /admin - вход в админ-панель
bot.command('admin', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    // Проверяем, является ли пользователь админом
    const isAdmin = await database.isAdmin(userId);

    if (!isAdmin) {
        await ctx.reply(t('admin.access_denied', lang));
        return;
    }

    // Показываем админ-панель
    const adminKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback(t('admin.button_statistics', lang), 'admin_stats')],
        [Markup.button.callback(t('admin.button_broadcast', lang), 'admin_broadcast')],
        [Markup.button.callback(t('admin.button_export', lang), 'admin_export')],
        [Markup.button.callback(t('admin.button_settings', lang), 'admin_settings')]
    ]);

    await ctx.reply(t('admin.panel_title', lang), adminKeyboard);
});

// Обработка кнопки "Статистика" в админке
bot.action('admin_stats', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    const isAdmin = await database.isAdmin(userId);
    if (!isAdmin) {
        await ctx.answerCbQuery(t('admin.access_denied', lang));
        return;
    }

    await ctx.answerCbQuery('📊 Loading statistics...');

    // Получаем полную статистику
    const stats = await database.getFullStats();

    if (!stats) {
        await ctx.reply(t('errors.general', lang));
        return;
    }

    const message = `
${t('admin.statistics.title', lang)}

${t('admin.statistics.total_users', lang, { count: stats.total_users })}
${t('admin.statistics.new_week', lang, { count: stats.new_this_week })}
${t('admin.statistics.new_month', lang, { count: stats.new_this_month })}
${t('admin.statistics.last_month', lang, { count: stats.new_last_month })}

${t('admin.statistics.by_language', lang)}
${t('admin.statistics.german', lang, { count: stats.by_language.de || 0 })}
${t('admin.statistics.english', lang, { count: stats.by_language.en || 0 })}
${t('admin.statistics.not_set', lang, { count: stats.by_language.null || 0 })}
    `.trim();

    const backKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback(t('admin.button_back', lang), 'admin_back')]
    ]);

    await ctx.reply(message, backKeyboard);
});

// Обработка кнопки "Назад" в админке
bot.action('admin_back', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    const adminKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback(t('admin.button_statistics', lang), 'admin_stats')],
        [Markup.button.callback(t('admin.button_broadcast', lang), 'admin_broadcast')],
        [Markup.button.callback(t('admin.button_export', lang), 'admin_export')],
        [Markup.button.callback(t('admin.button_settings', lang), 'admin_settings')]
    ]);

    await ctx.editMessageText(t('admin.panel_title', lang), adminKeyboard);
});

// Обработка кнопки "Экспорт данных" в админке
bot.action('admin_export', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    const isAdmin = await database.isAdmin(userId);
    if (!isAdmin) {
        await ctx.answerCbQuery(t('admin.access_denied', lang));
        return;
    }

    await ctx.answerCbQuery();

    const exportKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback(t('admin.export.button_full_excel', lang), 'export_excel')],
        [Markup.button.callback(t('admin.export.button_full_csv', lang), 'export_csv')],
        [Markup.button.callback(t('admin.export.button_usernames', lang), 'export_usernames')],
        [Markup.button.callback(t('admin.export.button_user_ids', lang), 'export_ids')],
        [Markup.button.callback(t('admin.button_back', lang), 'admin_back')]
    ]);

    await ctx.editMessageText(t('admin.export.title', lang), exportKeyboard);
});

// Обработка кнопки "Настройки" в админке
bot.action('admin_settings', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    const isAdmin = await database.isAdmin(userId);
    if (!isAdmin) {
        await ctx.answerCbQuery(t('admin.access_denied', lang));
        return;
    }

    await ctx.answerCbQuery();

    const settings = await database.getBotSettings();

    const phoneStatus = settings.phone_number_required
        ? t('admin.settings.phone_enabled', lang)
        : t('admin.settings.phone_disabled', lang);

    const message = `
${t('admin.settings.title', lang)}

⏰ ${t('admin.settings.current_interval', lang, { hours: settings.notification_interval_hours || 2 })}

📱 ${t('admin.settings.phone_status', lang, { status: phoneStatus })}
    `.trim();

    const settingsKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback(t('admin.settings.notification_interval', lang), 'settings_interval')],
        [Markup.button.callback(t('admin.settings.button_toggle_phone', lang), 'settings_toggle_phone')],
        [Markup.button.callback(t('admin.button_back', lang), 'admin_back')]
    ]);

    await ctx.editMessageText(message, settingsKeyboard);
});

// Переключение запроса номера телефона
bot.action('settings_toggle_phone', async (ctx) => {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    const isAdmin = await database.isAdmin(userId);
    if (!isAdmin) {
        await ctx.answerCbQuery(t('admin.access_denied', lang));
        return;
    }

    const settings = await database.getBotSettings();
    const newValue = !settings.phone_number_required;

    await database.updateSettings({ phone_number_required: newValue });

    const status = newValue
        ? t('admin.settings.enabled', lang)
        : t('admin.settings.disabled', lang);

    await ctx.answerCbQuery(t('admin.settings.phone_toggled', lang, { status }));

    // Обновляем сообщение с настройками
    const phoneStatus = newValue
        ? t('admin.settings.phone_enabled', lang)
        : t('admin.settings.phone_disabled', lang);

    const message = `
${t('admin.settings.title', lang)}

⏰ ${t('admin.settings.current_interval', lang, { hours: settings.notification_interval_hours || 2 })}

📱 ${t('admin.settings.phone_status', lang, { status: phoneStatus })}
    `.trim();

    const settingsKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback(t('admin.settings.notification_interval', lang), 'settings_interval')],
        [Markup.button.callback(t('admin.settings.button_toggle_phone', lang), 'settings_toggle_phone')],
        [Markup.button.callback(t('admin.button_back', lang), 'admin_back')]
    ]);

    await ctx.editMessageText(message, settingsKeyboard);
});

// Обработка всех остальных текстовых сообщений (эхо)
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

// Обработка ошибок
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
    dropPendingUpdates: true // Игнорируем старые сообщения при запуске
}).then(() => {
    console.log('✅ Bot started successfully!');
    console.log('🔗 Bot username: @' + bot.botInfo.username);
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