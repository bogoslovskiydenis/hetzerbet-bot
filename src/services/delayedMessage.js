import { Markup } from 'telegraf';
import { database } from '../config/services/database.js';

/**
 * Отправить отложенное сообщение пользователю
 */
export async function sendDelayedMessage(bot, userId, language) {
    try {
        // Получаем случайное отложенное сообщение из базы данных
        const message = await database.getRandomDelayedMessage(language);

        if (!message || !message.text) {
            console.log(`⚠️ No delayed messages available for user ${userId}`);
            return false;
        }

        // Формируем кнопки
        let keyboard = null;
        if (message.buttons && message.buttons.length > 0) {
            const buttonRows = [];
            for (const btn of message.buttons) {
                if (btn.text && btn.url) {
                    buttonRows.push([Markup.button.url(btn.text, btn.url)]);
                }
            }
            if (buttonRows.length > 0) {
                keyboard = Markup.inlineKeyboard(buttonRows);
            }
        }

        // Отправляем сообщение
        if (message.image_url) {
            try {
                await bot.telegram.sendPhoto(userId, message.image_url, {
                    caption: message.text,
                    ...(keyboard || {})
                });
            } catch (error) {
                console.error(`❌ Error sending delayed message photo to ${userId}:`, error);
                // Пробуем отправить без картинки
                await bot.telegram.sendMessage(userId, message.text, keyboard || {});
            }
        } else {
            await bot.telegram.sendMessage(userId, message.text, keyboard || {});
        }

        console.log(`✅ Delayed message sent to user ${userId}`);
        return true;
    } catch (error) {
        console.error(`❌ Error sending delayed message to ${userId}:`, error);
        return false;
    }
}

/**
 * Запланировать отправку отложенного сообщения
 */
export function scheduleDelayedMessage(bot, userId, language) {
    try {
        database.getBotSettings().then(async (settings) => {
            // Проверяем, есть ли активные отложенные сообщения
            const messages = await database.getDelayedMessages();
            
            if (messages.length === 0) {
                console.log(`⚠️ No active delayed messages found, skipping for user ${userId}`);
                return;
            }

            const delayMinutes = settings?.delayed_message_delay_minutes || 15;
            const delayMs = delayMinutes * 60 * 1000;

            console.log(`⏰ Scheduling delayed message for user ${userId} in ${delayMinutes} minutes`);

            setTimeout(async () => {
                await sendDelayedMessage(bot, userId, language);
            }, delayMs);
        });
    } catch (error) {
        console.error(`❌ Error scheduling delayed message for ${userId}:`, error);
    }
}
