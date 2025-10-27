import { Markup } from 'telegraf';
import { t } from '../locales/i18n.js';
import { getMainKeyboard } from './keyboards.js';

/**
 * Отправить приветственное сообщение с изображением
 */
export async function sendWelcomeMessageWithImage(ctx, language) {
    const welcomeImageUrl = "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=800";

    if (welcomeImageUrl) {
        try {
            await ctx.replyWithPhoto(
                welcomeImageUrl,
                {
                    caption: t('main.welcome_text', language),
                    ...getMainKeyboard(language)
                }
            );
        } catch (error) {
            console.error('❌ Error sending welcome image:', error);
            await ctx.reply(
                t('main.welcome_text', language),
                getMainKeyboard(language)
            );
        }
    } else {
        await ctx.reply(
            t('main.welcome_text', language),
            getMainKeyboard(language)
        );
    }
}

