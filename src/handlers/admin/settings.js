import { Markup } from 'telegraf';
import { database } from '../../config/services/database.js';
import { t } from '../../locales/i18n.js';
import { getSettingsKeyboard, getWelcomeSettingsKeyboard, getIntervalSettingsKeyboard } from '../../utils/keyboards.js';
import { adminMiddleware } from './index.js';

/**
 * Получить язык пользователя
 */
async function getUserLanguage(userId) {
    const user = await database.getUser(userId);
    return user?.language || 'en';
}

/**
 * Форматировать сообщение с настройками
 */
function formatSettingsMessage(settings, lang) {
    const phoneStatus = settings.phone_number_required
        ? t('admin.settings.phone_enabled', lang)
        : t('admin.settings.phone_disabled', lang);

    const intervalMinutes = settings.notification_interval_minutes || 120;
    const intervalHours = Math.floor(intervalMinutes / 60);
    const remainingMinutes = intervalMinutes % 60;

    let intervalText = '';
    if (intervalHours > 0 && remainingMinutes > 0) {
        intervalText = t('admin.settings.current_interval_hours_minutes', lang, {
            hours: intervalHours,
            minutes: remainingMinutes
        });
    } else if (intervalHours > 0) {
        intervalText = t('admin.settings.current_interval_hours', lang, {
            hours: intervalHours
        });
    } else {
        intervalText = t('admin.settings.current_interval_minutes', lang, {
            minutes: intervalMinutes
        });
    }

    return `
${t('admin.settings.title', lang)}

⏰ ${intervalText}

📱 ${t('admin.settings.phone_status', lang, { status: phoneStatus })}
    `.trim();
}

/**
 * Обработчик кнопки "Настройки"
 */
export async function handleSettings(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`⚙️ User ${userId} opened settings`);

    try {
        // Получаем текущие настройки
        const settings = await database.getBotSettings();

        if (!settings) {
            await ctx.reply(t('errors.general', lang));
            return;
        }

        // Форматируем и отправляем сообщение
        const message = formatSettingsMessage(settings, lang);

        await ctx.editMessageText(
            message,
            getSettingsKeyboard(lang)
        );

    } catch (error) {
        console.error('❌ Error loading settings:', error);
        await ctx.reply(t('errors.general', lang));
    }
}

/**
 * Переключение запроса номера телефона
 */
export async function handleTogglePhone(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    console.log(`📱 User ${userId} toggling phone requirement`);

    try {
        // Получаем текущие настройки
        const settings = await database.getBotSettings();
        const newValue = !settings.phone_number_required;

        // Обновляем в БД
        await database.updateSettings({
            phone_number_required: newValue
        });

        const status = newValue
            ? t('admin.settings.enabled', lang)
            : t('admin.settings.disabled', lang);

        await ctx.answerCbQuery(
            t('admin.settings.phone_toggled', lang, { status })
        );

        console.log(`✅ Phone requirement set to: ${newValue}`);

        // Обновляем сообщение с новыми настройками
        const updatedSettings = await database.getBotSettings();
        const message = formatSettingsMessage(updatedSettings, lang);

        await ctx.editMessageText(
            message,
            getSettingsKeyboard(lang)
        );

    } catch (error) {
        console.error('❌ Error toggling phone requirement:', error);
        await ctx.answerCbQuery(t('errors.general', lang));
    }
}

/**
 * Обработчик меню настроек интервала
 */
export async function handleIntervalMenu(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    console.log(`⏰ User ${userId} opened interval settings menu`);

    try {
        const settings = await database.getBotSettings();
        const intervalMinutes = settings.notification_interval_minutes || 120;
        const intervalHours = Math.floor(intervalMinutes / 60);
        const remainingMinutes = intervalMinutes % 60;

        let intervalText = '';
        if (intervalHours > 0 && remainingMinutes > 0) {
            intervalText = `${intervalHours}ч ${remainingMinutes}м`;
        } else if (intervalHours > 0) {
            intervalText = `${intervalHours}ч`;
        } else {
            intervalText = `${intervalMinutes}м`;
        }

        const message =
            `⏰ НАСТРОЙКИ ИНТЕРВАЛА УВЕДОМЛЕНИЙ\n\n` +
            `Текущий интервал: ${intervalText}\n\n` +
            `Выберите способ изменения интервала:`;

        // Если пришёл callback от кнопки — редактируем то сообщение.
        // Если вызвано из текстового сообщения — отправляем новое.
        if (ctx.callbackQuery) {
            await ctx.answerCbQuery();
            await ctx.editMessageText(
                message,
                getIntervalSettingsKeyboard(lang)
            );
        } else {
            await ctx.reply(
                message,
                getIntervalSettingsKeyboard(lang)
            );
        }

    } catch (error) {
        console.error('❌ Error loading interval settings:', error);
        await ctx.reply(t('errors.general', lang));
    }
}

/**
 * Обработчик изменения интервала уведомлений (в часах)
 */
export async function handleNotificationInterval(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`⏰ User ${userId} changing notification interval (hours)`);

    try {
        // Получаем текущие настройки
        const settings = await database.getBotSettings();
        const currentInterval = settings.notification_interval_hours || 2;

        // Отправляем сообщение с инструкцией и кнопкой отмены
        await ctx.reply(
            t('admin.settings.set_interval', lang) + '\n\n' +
            `Текущий интервал: ${currentInterval} часов\n\n` +
            t('admin.settings.interval_instructions', lang),
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'settings_interval_cancel')]
            ])
        );

        // Устанавливаем состояние ожидания ввода интервала
        await database.updateUser(userId, {
            awaiting_input: 'notification_interval'
        });

    } catch (error) {
        console.error('❌ Error setting notification interval:', error);
        await ctx.reply(t('errors.general', lang));
    }
}

/**
 * Обработчик изменения интервала уведомлений (в минутах)
 */
export async function handleNotificationIntervalMinutes(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`⏰ User ${userId} changing notification interval (minutes)`);

    try {
        // Получаем текущие настройки
        const settings = await database.getBotSettings();
        const currentIntervalMinutes = settings.notification_interval_minutes || 120;

        // Отправляем сообщение с инструкцией и кнопкой отмены
        await ctx.reply(
            t('admin.settings.set_interval_minutes', lang) + '\n\n' +
            `Текущий интервал: ${currentIntervalMinutes} минут\n\n` +
            t('admin.settings.interval_minutes_instructions', lang),
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'settings_interval_cancel')]
            ])
        );

        // Устанавливаем состояние ожидания ввода интервала в минутах
        await database.updateUser(userId, {
            awaiting_input: 'notification_interval_minutes'
        });

    } catch (error) {
        console.error('❌ Error setting notification interval (minutes):', error);
        await ctx.reply(t('errors.general', lang));
    }
}

/**
 * Обработчик ввода интервала уведомлений (в часах)
 */
export async function handleNotificationIntervalInput(ctx, inputText) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    try {
        // Проверяем на отмену (обратная совместимость с /cancel)
        if (inputText.toLowerCase() === '/cancel') {
            await database.updateUser(userId, { awaiting_input: null });
            await ctx.reply('❌ Изменение интервала отменено.');
            await handleIntervalMenu(ctx);
            return;
        }

        // Парсим введенное значение
        const interval = parseInt(inputText.trim());
        
        // Валидация
        if (isNaN(interval) || interval < 1 || interval > 24) {
            await ctx.reply(t('admin.settings.interval_invalid', lang));
            return;
        }

        // Обновляем настройки в БД
        await database.updateSettings({
            notification_interval_hours: interval,
            notification_interval_minutes: interval * 60
        });

        // Сбрасываем состояние ожидания
        await database.updateUser(userId, { awaiting_input: null });

        // Уведомляем об успехе
        await ctx.reply(
            t('admin.settings.interval_success', lang, { hours: interval })
        );

        console.log(`✅ Notification interval updated to ${interval} hours by ${userId}`);

        // Перезапускаем планировщик уведомлений
        await restartNotificationScheduler();

        // Возвращаемся в меню настроек интервала
        await handleIntervalMenu(ctx);

    } catch (error) {
        console.error('❌ Error processing interval input:', error);
        await ctx.reply('❌ Ошибка при обновлении интервала. Попробуйте еще раз.');
    }
}

/**
 * Обработчик ввода интервала уведомлений (в минутах)
 */
export async function handleNotificationIntervalMinutesInput(ctx, inputText) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    try {
        // Проверяем на отмену (обратная совместимость с /cancel)
        if (inputText.toLowerCase() === '/cancel') {
            await database.updateUser(userId, { awaiting_input: null });
            await ctx.reply('❌ Изменение интервала отменено.');
            await handleIntervalMenu(ctx);
            return;
        }

        // Парсим введенное значение
        const intervalMinutes = parseInt(inputText.trim());
        
        // Валидация
        if (isNaN(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
            await ctx.reply(t('admin.settings.interval_minutes_invalid', lang));
            return;
        }

        // Обновляем настройки в БД
        const intervalHours = Math.floor(intervalMinutes / 60);
        await database.updateSettings({
            notification_interval_hours: intervalHours,
            notification_interval_minutes: intervalMinutes
        });

        // Сбрасываем состояние ожидания
        await database.updateUser(userId, { awaiting_input: null });

        // Уведомляем об успехе
        await ctx.reply(
            t('admin.settings.interval_minutes_success', lang, { minutes: intervalMinutes })
        );

        console.log(`✅ Notification interval updated to ${intervalMinutes} minutes by ${userId}`);

        // Перезапускаем планировщик уведомлений
        await restartNotificationScheduler();

        // Возвращаемся в меню настроек интервала
        await handleIntervalMenu(ctx);

    } catch (error) {
        console.error('❌ Error processing interval minutes input:', error);
        await ctx.reply('❌ Ошибка при обновлении интервала. Попробуйте еще раз.');
    }
}

/**
 * Перезапуск планировщика уведомлений
 */
async function restartNotificationScheduler() {
    try {
        // Импортируем планировщик
        const { stopNotificationScheduler, startNotificationScheduler } = await import('../../services/notifications.js');
        
        // Останавливаем текущий планировщик
        stopNotificationScheduler();
        
        // Получаем бот из глобального объекта или импортируем
        const bot = global.bot || global.telegramBot;
        
        if (bot) {
            // Запускаем новый с обновленными настройками
            setTimeout(() => {
                startNotificationScheduler(bot);
            }, 1000);
            
            console.log('🔄 Notification scheduler restarted with new interval');
        } else {
            console.log('⚠️ Bot instance not found, scheduler will restart on next bot restart');
        }
    } catch (error) {
        console.error('❌ Error restarting scheduler:', error);
    }
}

/**
 * Обработчик меню Welcome настроек
 */
export async function handleWelcomeMenu(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`👋 User ${userId} opened welcome settings menu`);

    try {
        const settings = await database.getBotSettings();
        const currentTextDe = settings.welcome_text?.de || 'не установлено';
        const currentTextEn = settings.welcome_text?.en || 'не установлено';
        const currentImageUrl = settings.welcome_image_url || 'не установлено';

        const message = 
            `👋 НАСТРОЙКИ ПРИВЕТСТВИЯ\n\n` +
            `📝 Текст:\n` +
            `🇩🇪 DE: ${currentTextDe.substring(0, 50)}${currentTextDe.length > 50 ? '...' : ''}\n` +
            `🇬🇧 EN: ${currentTextEn.substring(0, 50)}${currentTextEn.length > 50 ? '...' : ''}\n\n` +
            `🖼️ Картинка:\n${currentImageUrl}`;

        await ctx.editMessageText(
            message,
            getWelcomeSettingsKeyboard(lang)
        );

    } catch (error) {
        console.error('❌ Error loading welcome settings:', error);
        await ctx.reply(t('errors.general', lang));
    }
}

/**
 * Обработчик изменения welcome текста
 */
export async function handleWelcomeText(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`📝 User ${userId} changing welcome text`);

    try {
        const settings = await database.getBotSettings();
        const currentTextDe = settings.welcome_text?.de || '';
        const currentTextEn = settings.welcome_text?.en || '';

        await ctx.reply(
            `📝 Изменение приветственного текста\n\n` +
            `🇩🇪 Текущий текст (DE):\n${currentTextDe}\n\n` +
            `🇬🇧 Текущий текст (EN):\n${currentTextEn}\n\n` +
            `Отправьте новый текст в формате:\n` +
            `DE: текст на немецком\n` +
            `EN: текст на английском`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'settings_welcome_cancel')]
            ])
        );

        await database.updateUser(userId, {
            awaiting_input: 'welcome_text'
        });

    } catch (error) {
        console.error('❌ Error changing welcome text:', error);
        await ctx.reply(t('errors.general', lang));
    }
}

/**
 * Обработчик ввода welcome текста
 */
export async function handleWelcomeTextInput(ctx, inputText) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    try {
        // Проверяем на отмену (обратная совместимость с /cancel)
        if (inputText.toLowerCase() === '/cancel') {
            await database.updateUser(userId, { awaiting_input: null });
            await ctx.reply('❌ Изменение отменено.');
            await handleWelcomeMenu(ctx);
            return;
        }

        const lines = inputText.trim().split('\n');
        let textDe = '';
        let textEn = '';

        for (const line of lines) {
            if (line.trim().startsWith('DE:')) {
                textDe = line.replace(/^DE:\s*/i, '').trim();
            } else if (line.trim().startsWith('EN:')) {
                textEn = line.replace(/^EN:\s*/i, '').trim();
            } else if (textDe && !textEn) {
                textDe += '\n' + line;
            } else if (textEn) {
                textEn += '\n' + line;
            }
        }

        if (!textDe || !textEn) {
            await ctx.reply('❌ Неверный формат. Укажите тексты для обоих языков:\nDE: текст\nEN: текст');
            return;
        }

        await database.updateSettings({
            welcome_text: {
                de: textDe.trim(),
                en: textEn.trim()
            }
        });

        await database.updateUser(userId, { awaiting_input: null });

        await ctx.reply('✅ Welcome текст обновлен!');

        console.log(`✅ Welcome text updated by ${userId}`);

        // Возвращаемся в меню welcome настроек
        const settings = await database.getBotSettings();
        const currentTextDe = settings.welcome_text?.de || 'не установлено';
        const currentTextEn = settings.welcome_text?.en || 'не установлено';
        const currentImageUrl = settings.welcome_image_url || 'не установлено';

        const message = 
            `👋 НАСТРОЙКИ ПРИВЕТСТВИЯ\n\n` +
            `📝 Текст:\n` +
            `🇩🇪 DE: ${currentTextDe.substring(0, 50)}${currentTextDe.length > 50 ? '...' : ''}\n` +
            `🇬🇧 EN: ${currentTextEn.substring(0, 50)}${currentTextEn.length > 50 ? '...' : ''}\n\n` +
            `🖼️ Картинка:\n${currentImageUrl}`;

        await ctx.reply(message, getWelcomeSettingsKeyboard(lang));

    } catch (error) {
        console.error('❌ Error processing welcome text input:', error);
        await ctx.reply('❌ Ошибка при обновлении текста. Попробуйте еще раз.');
    }
}

/**
 * Обработчик изменения welcome картинки
 */
export async function handleWelcomeImage(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`🖼️ User ${userId} changing welcome image`);

    try {
        const settings = await database.getBotSettings();
        const currentImageUrl = settings.welcome_image_url || 'не установлено';

        await ctx.reply(
            `🖼️ Изменение приветственной картинки\n\n` +
            `Текущая картинка: ${currentImageUrl}\n\n` +
            `Отправьте новый URL картинки:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'settings_welcome_cancel')]
            ])
        );

        await database.updateUser(userId, {
            awaiting_input: 'welcome_image'
        });

    } catch (error) {
        console.error('❌ Error changing welcome image:', error);
        await ctx.reply(t('errors.general', lang));
    }
}

/**
 * Обработчик ввода URL welcome картинки
 */
export async function handleWelcomeImageInput(ctx, inputText) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    try {
        // Проверяем на отмену (обратная совместимость с /cancel)
        if (inputText.toLowerCase() === '/cancel') {
            await database.updateUser(userId, { awaiting_input: null });
            await ctx.reply('❌ Изменение отменено.');
            await handleWelcomeMenu(ctx);
            return;
        }

        const imageUrl = inputText.trim();

        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            await ctx.reply('❌ Неверный URL. Он должен начинаться с http:// или https://');
            return;
        }

        await database.updateSettings({
            welcome_image_url: imageUrl
        });

        await database.updateUser(userId, { awaiting_input: null });

        await ctx.reply('✅ Welcome картинка обновлена!');

        console.log(`✅ Welcome image updated by ${userId}`);

        // Возвращаемся в меню welcome настроек
        const settings = await database.getBotSettings();
        const currentTextDe = settings.welcome_text?.de || 'не установлено';
        const currentTextEn = settings.welcome_text?.en || 'не установлено';
        const currentImageUrl = settings.welcome_image_url || 'не установлено';

        const message = 
            `👋 НАСТРОЙКИ ПРИВЕТСТВИЯ\n\n` +
            `📝 Текст:\n` +
            `🇩🇪 DE: ${currentTextDe.substring(0, 50)}${currentTextDe.length > 50 ? '...' : ''}\n` +
            `🇬🇧 EN: ${currentTextEn.substring(0, 50)}${currentTextEn.length > 50 ? '...' : ''}\n\n` +
            `🖼️ Картинка:\n${currentImageUrl}`;

        await ctx.reply(message, getWelcomeSettingsKeyboard(lang));

    } catch (error) {
        console.error('❌ Error processing welcome image input:', error);
        await ctx.reply('❌ Ошибка при обновлении картинки. Попробуйте еще раз.');
    }
}

/**
 * Обработчик отмены изменения интервала
 */
export async function handleIntervalCancel(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    // Очищаем состояние
    await database.updateUser(userId, { awaiting_input: null });

    await ctx.reply('❌ Изменение интервала отменено.');

    // Возвращаемся в меню настроек интервала
    await handleIntervalMenu(ctx);
}

/**
 * Обработчик отмены изменения welcome настроек
 */
export async function handleWelcomeCancel(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    // Очищаем состояние
    await database.updateUser(userId, { awaiting_input: null });

    await ctx.reply('❌ Изменение отменено.');

    // Возвращаемся в меню welcome настроек
    await handleWelcomeMenu(ctx);
}

/**
 * Регистрация обработчиков настроек
 */
export function registerSettingsHandlers(bot) {
    bot.action('admin_settings', adminMiddleware, handleSettings);
    bot.action('settings_toggle_phone', adminMiddleware, handleTogglePhone);
    bot.action('settings_interval', adminMiddleware, handleIntervalMenu);
    bot.action('settings_interval_hours', adminMiddleware, handleNotificationInterval);
    bot.action('settings_interval_minutes', adminMiddleware, handleNotificationIntervalMinutes);
    bot.action('settings_interval_cancel', adminMiddleware, handleIntervalCancel);
    bot.action('settings_welcome_menu', adminMiddleware, handleWelcomeMenu);
    bot.action('settings_welcome_text', adminMiddleware, handleWelcomeText);
    bot.action('settings_welcome_image', adminMiddleware, handleWelcomeImage);
    bot.action('settings_welcome_cancel', adminMiddleware, handleWelcomeCancel);

    console.log('✅ Settings handlers registered');
}