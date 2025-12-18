import { Markup } from 'telegraf';
import { database } from '../config/services/database.js';
import { t } from '../locales/i18n.js';
import { sendWelcomeMessageWithImage } from '../utils/welcome.js';
import { scheduleDelayedMessage } from '../services/delayedMessage.js';

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
        [Markup.button.contactRequest(t('phone.button_share', language))]
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
    await sendWelcomeMessageWithImage(ctx, lang);

    // Планируем отложенное сообщение
    const bot = global.bot;
    if (bot) {
        scheduleDelayedMessage(bot, userId, lang);
    }
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
    await sendWelcomeMessageWithImage(ctx, lang);

    // Планируем отложенное сообщение
    const bot = global.bot;
    if (bot) {
        scheduleDelayedMessage(bot, userId, lang);
    }

    return true;
}

/**
 * Проверить, находится ли пользователь на этапе запроса телефона
 */
export async function isAwaitingPhone(userId) {
    const user = await database.getUser(userId);
    return user?.onboarding_step === 'phone_request';
}