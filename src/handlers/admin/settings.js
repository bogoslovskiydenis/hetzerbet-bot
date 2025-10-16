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

    return `
${t('admin.settings.title', lang)}

⏰ ${t('admin.settings.current_interval', lang, {
        hours: settings.notification_interval_hours || 2
    })}

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
 * Обработчик изменения интервала уведомлений
 * TODO: Реализовать сбор значения от пользователя
 */
export async function handleNotificationInterval(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    // Пока что просто уведомляем, что функция в разработке
    await ctx.reply(
        'Функция изменения интервала.\n\n'
    );

    console.log(`⏰ User ${userId} tried to change notification interval`);
}

/**
 * Регистрация обработчиков настроек
 */
export function registerSettingsHandlers(bot) {
    bot.action('admin_settings', adminMiddleware, handleSettings);
    bot.action('settings_toggle_phone', adminMiddleware, handleTogglePhone);
    bot.action('settings_interval', adminMiddleware, handleNotificationInterval);

    console.log('✅ Settings handlers registered');
}