import { Markup } from 'telegraf';
import { t } from '../locales/i18n.js';
import { getMainKeyboard } from './keyboards.js';
import { database } from '../config/services/database.js';

/**
 * Получить welcome текст из настроек или локализации
 */
async function getWelcomeText(language) {
    try {
        const settings = await database.getBotSettings();
        const customText = settings?.welcome_text?.[language];
        
        if (customText) {
            return customText;
        }
        
        return t('main.welcome_text', language);
    } catch (error) {
        console.error('❌ Error getting welcome text:', error);
        return t('main.welcome_text', language);
    }
}

/**
 * Получить URL welcome картинки из настроек
 */
async function getWelcomeImageUrl() {
    try {
        const settings = await database.getBotSettings();
        return settings?.welcome_image_url || "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=800";
    } catch (error) {
        console.error('❌ Error getting welcome image:', error);
        return "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=800";
    }
}

/**
 * Отправить приветственное сообщение с изображением
 */
export async function sendWelcomeMessageWithImage(ctx, language) {
    const welcomeImageUrl = await getWelcomeImageUrl();
    const welcomeText = await getWelcomeText(language);

    if (welcomeImageUrl) {
        try {
            await ctx.replyWithPhoto(
                welcomeImageUrl,
                {
                    caption: welcomeText,
                    ...getMainKeyboard(language)
                }
            );
        } catch (error) {
            console.error('❌ Error sending welcome image:', error);
            await ctx.reply(
                welcomeText,
                getMainKeyboard(language)
            );
        }
    } else {
        await ctx.reply(
            welcomeText,
            getMainKeyboard(language)
        );
    }
}

