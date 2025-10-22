import { database } from '../../config/services/database.js';
import { t } from '../../locales/i18n.js';
import { getSettingsKeyboard } from '../../utils/keyboards.js';
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

        // Отправляем сообщение с инструкцией
        await ctx.reply(
            t('admin.settings.set_interval', lang) + '\n\n' +
            `Текущий интервал: ${currentInterval} часов\n` +
            t('admin.settings.interval_instructions', lang)
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

        // Отправляем сообщение с инструкцией
        await ctx.reply(
            t('admin.settings.set_interval_minutes', lang) + '\n\n' +
            `Текущий интервал: ${currentIntervalMinutes} минут\n` +
            t('admin.settings.interval_minutes_instructions', lang)
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
        // Проверяем на отмену
        if (inputText.toLowerCase() === '/cancel') {
            await database.updateUser(userId, { awaiting_input: null });
            await ctx.reply(t('admin.settings.interval_cancelled', lang));
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
        // Проверяем на отмену
        if (inputText.toLowerCase() === '/cancel') {
            await database.updateUser(userId, { awaiting_input: null });
            await ctx.reply(t('admin.settings.interval_cancelled', lang));
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
 * Регистрация обработчиков настроек
 */
export function registerSettingsHandlers(bot) {
    bot.action('admin_settings', adminMiddleware, handleSettings);
    bot.action('settings_toggle_phone', adminMiddleware, handleTogglePhone);
    bot.action('settings_interval', adminMiddleware, handleNotificationInterval);
    bot.action('settings_interval_minutes', adminMiddleware, handleNotificationIntervalMinutes);

    console.log('✅ Settings handlers registered');
}