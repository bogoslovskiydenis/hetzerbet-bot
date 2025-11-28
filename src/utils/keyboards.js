import { Markup } from 'telegraf';
import { t } from '../locales/i18n.js';

/**
 * Клавиатура для проверки подписки на канал
 */
export function getSubscriptionKeyboard(language, channelUrl) {
    return Markup.inlineKeyboard([
        [Markup.button.url(
            t('subscription.button_subscribe', language),
            channelUrl
        )],
        [Markup.button.callback(
            t('subscription.button_check', language),
            'check_subscription'
        )]
    ]);
}

/**
 * Основная клавиатура для главного экрана
 */
export function getMainKeyboard(language) {
    const miniAppUrl =  'https://hertzbet.com/en';
    
    return Markup.inlineKeyboard([
        [{
            text: t('main.button_play_bot', language),
            web_app: { url: miniAppUrl }
        }],
        [Markup.button.url(
            t('main.button_play_web', language),
            process.env.WEBSITE_URL || 'https://hertzbet.com/en'
        )],
        [Markup.button.switchToChat(
            t('main.button_share', language),
            'Check out this amazing casino bot! 🎰'
        )]
    ]);
}

/**
 * Клавиатура выбора языка
 */
export function getLanguageKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('🇩🇪 Deutsch', 'language_de'),
            Markup.button.callback('🇬🇧 English', 'language_en')
        ]
    ]);
}

/**
 * Главное меню админ-панели
 */
export function getAdminKeyboard(language) {
    return Markup.inlineKeyboard([
        [Markup.button.callback(
            t('admin.button_statistics', language),
            'admin_stats'
        )],
        [Markup.button.callback(
            t('admin.button_broadcast', language),
            'admin_broadcast'
        )],
        [Markup.button.callback(
            '📢 Уведомления',
            'admin_notifications'
        )],
        [Markup.button.callback(
            t('admin.button_promolinks', language),
            'admin_promolinks'
        )],
        [Markup.button.callback(
            t('admin.button_export', language),
            'admin_export'
        )],
        [Markup.button.callback(
            t('admin.button_settings', language),
            'admin_settings'
        )]
    ]);
}

/**
 * Кнопка "Назад" в админке
 */
export function getBackButton(language) {
    return Markup.inlineKeyboard([
        [Markup.button.callback(
            t('admin.button_back', language),
            'admin_back'
        )]
    ]);
}

/**
 * Клавиатура для подтверждения (Да/Нет)
 */
export function getConfirmKeyboard(language, yesCallback, noCallback) {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback(
                t('commands.button_yes', language),
                yesCallback
            ),
            Markup.button.callback(
                t('commands.button_no', language),
                noCallback
            )
        ]
    ]);
}

/**
 * Клавиатура для экспорта данных
 */
export function getExportKeyboard(language) {
    return Markup.inlineKeyboard([
        [Markup.button.callback(
            t('admin.export.button_full_excel', language),
            'export_excel'
        )],
        [Markup.button.callback(
            t('admin.export.button_full_csv', language),
            'export_csv'
        )],
        [Markup.button.callback(
            t('admin.export.button_usernames', language),
            'export_usernames'
        )],
        [Markup.button.callback(
            t('admin.export.button_user_ids', language),
            'export_ids'
        )],
        [Markup.button.callback(
            t('admin.button_back', language),
            'admin_back'
        )]
    ]);
}

/**
 * Клавиатура для настроек
 */
export function getSettingsKeyboard(language) {
    return Markup.inlineKeyboard([
        [Markup.button.callback(
            t('admin.settings.notification_interval', language),
            'settings_interval'
        )],
        [Markup.button.callback(
            t('admin.settings.notification_interval_minutes', language),
            'settings_interval_minutes'
        )],
        [Markup.button.callback(
            t('admin.settings.button_toggle_phone', language),
            'settings_toggle_phone'
        )],
        [Markup.button.callback(
            '👋 Welcome Settings',
            'settings_welcome_menu'
        )],
        [Markup.button.callback(
            t('admin.button_back', language),
            'admin_back'
        )]
    ]);
}

export function getWelcomeSettingsKeyboard(language) {
    return Markup.inlineKeyboard([
        [Markup.button.callback(
            '📝 Изменить текст',
            'settings_welcome_text'
        )],
        [Markup.button.callback(
            '🖼️ Изменить картинку',
            'settings_welcome_image'
        )],
        [Markup.button.callback(
            '◀️ Назад',
            'admin_settings'
        )]
    ]);
}