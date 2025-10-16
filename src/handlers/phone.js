import { Markup } from 'telegraf';
import { database } from '../config/services/database.js';
import { t } from '../locales/i18n.js';
import { getMainKeyboard } from '../utils/keyboards.js';

/**
 * Получить язык пользователя
 */
async function getUserLanguage(userId) {
    const user = await database.getUser(userId);
    return user?.language || 'en';
}

/**
 * Проверить, нужно ли запрашивать номер телефона
 */
export async function shouldRequestPhone() {
    const settings = await database.getBotSettings();
    return settings?.phone_number_required || false;
}

/**
 * Отправить запрос номера телефона
 */
export async function requestPhoneNumber(ctx, language) {
    const userId = ctx.from.id;

    console.log(`📱 Requesting phone number from user ${userId}`);

    // Клавиатура с кнопкой "Поделиться номером"
    const phoneKeyboard = Markup.keyboard([
        [Markup.button.contactRequest(t('phone.button_share', language))],
        [Markup.button.text(t('phone.button_skip', language))]
    ])
        .resize()
        .oneTime();

    await ctx.reply(
        t('phone.request_text', language),
        phoneKeyboard
    );

    // Обновляем шаг онбординга
    await database.updateUser(userId, {
        onboarding_step: 'phone_request'
    });
}

/**
 * Обработка полученного номера телефона
 */
export async function handlePhoneContact(ctx) {
    const userId = ctx.from.id;
    const phone = ctx.message.contact?.phone_number;
    const lang = await getUserLanguage(userId);

    console.log(`📱 User ${userId} shared phone: ${phone}`);

    // Проверяем что это контакт самого пользователя
    if (ctx.message.contact.user_id !== userId) {
        await ctx.reply(
            '⚠️ Please share YOUR phone number, not someone else\'s.',
            Markup.removeKeyboard()
        );
        return;
    }

    // Сохраняем номер телефона
    await database.updateUser(userId, {
        phone_number: phone,
        onboarding_step: 'completed',
        onboarding_completed: true
    });

    console.log(`✅ Phone number saved for user ${userId}`);

    // Убираем клавиатуру и отправляем подтверждение
    await ctx.reply(
        t('phone.success', lang),
        Markup.removeKeyboard()
    );

    // Отправляем приветственное сообщение
    await sendWelcomeMessage(ctx, lang);
}

/**
 * Обработка пропуска запроса телефона
 */
export async function handlePhoneSkip(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const text = ctx.message.text;

    // Проверяем что это кнопка "Пропустить"
    const skipButtonText = t('phone.button_skip', lang);

    if (text !== skipButtonText) {
        return false; // Это не кнопка пропуска
    }

    console.log(`⏭️ User ${userId} skipped phone request`);

    // Обновляем статус
    await database.updateUser(userId, {
        onboarding_step: 'completed',
        onboarding_completed: true
    });

    // Убираем клавиатуру и отправляем сообщение
    await ctx.reply(
        t('phone.skipped', lang),
        Markup.removeKeyboard()
    );

    // Отправляем приветственное сообщение
    await sendWelcomeMessage(ctx, lang);

    return true;
}

/**
 * Отправить приветственное сообщение с кнопками
 */
async function sendWelcomeMessage(ctx, language) {
    const welcomeImageUrl = "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=800";

    if (welcomeImageUrl) {
        // Если есть изображение - отправляем с caption
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
            // Если ошибка с изображением - отправляем просто текст
            await ctx.reply(
                t('main.welcome_text', language),
                getMainKeyboard(language)
            );
        }
    } else {
        // Если нет изображения - просто текст с кнопками
        await ctx.reply(
            t('main.welcome_text', language),
            getMainKeyboard(language)
        );
    }
}

/**
 * Проверить, находится ли пользователь на этапе запроса телефона
 */
export async function isAwaitingPhone(userId) {
    const user = await database.getUser(userId);
    return user?.onboarding_step === 'phone_request';
}