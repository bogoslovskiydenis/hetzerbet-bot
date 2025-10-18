import { Markup } from 'telegraf';
import { database } from '../config/services/database.js';
import { t } from '../locales/i18n.js';
import { getMainKeyboard } from '../utils/keyboards.js';

/**
 * Список промо-сообщений
 * Каждое промо содержит текст на обоих языках и медиа
 */
const PROMO_MESSAGES = [
    {
        de: {
            text: t('notifications.promo_1', 'de'),
            image: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=800'
        },
        en: {
            text: t('notifications.promo_1', 'en'),
            image: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=800'
        }
    },
    {
        de: {
            text: t('notifications.promo_2', 'de'),
            image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800'
        },
        en: {
            text: t('notifications.promo_2', 'en'),
            image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800'
        }
    },
    {
        de: {
            text: t('notifications.promo_3', 'de'),
            image: 'https://images.unsplash.com/photo-1579547944212-c4f4961a8dd8?w=800'
        },
        en: {
            text: t('notifications.promo_3', 'en'),
            image: 'https://images.unsplash.com/photo-1579547944212-c4f4961a8dd8?w=800'
        }
    }
];

/**
 * Получить случайное промо-сообщение
 */
function getRandomPromo(language) {
    const randomIndex = Math.floor(Math.random() * PROMO_MESSAGES.length);
    const promo = PROMO_MESSAGES[randomIndex];
    return promo[language] || promo.en;
}

/**
 * Проверить, можно ли отправить уведомление пользователю
 */
async function canSendNotification(user, settings) {
    // Проверка 1: Включены ли уведомления у пользователя
    if (!user.notifications_enabled) {
        return false;
    }

    // Проверка 2: Тихие часы (quiet hours) - ОТКЛЮЧЕНО ДЛЯ ТЕСТА
    // if (settings.notification_schedule?.enabled) {
    //     const now = new Date();
    //     const currentHour = now.getHours();
    //     const quietStart = settings.notification_schedule.quiet_hours_start || 23;
    //     const quietEnd = settings.notification_schedule.quiet_hours_end || 8;

    //     if (quietStart > quietEnd) {
    //         if (currentHour >= quietStart || currentHour < quietEnd) {
    //             console.log(`🔇 User ${user.user_id} in quiet hours`);
    //             return false;
    //         }
    //     } else {
    //         if (currentHour >= quietStart && currentHour < quietEnd) {
    //             console.log(`🔇 User ${user.user_id} in quiet hours`);
    //             return false;
    //         }
    //     }
    // }

    // Проверка 3: Лимит уведомлений в день - УВЕЛИЧЕН ДЛЯ ТЕСТА
    const maxPerDay = 100; // Было: 12
    const todayCount = await database.getTodayNotificationCount(user.user_id);

    if (todayCount >= maxPerDay) {
        console.log(`🚫 User ${user.user_id} reached daily limit (${todayCount}/${maxPerDay})`);
        return false;
    }

    // Проверка 4: Минимальный интервал между уведомлениями - ОТКЛЮЧЕНО ДЛЯ ТЕСТА
    // if (user.last_notification_time) {
    //     const lastNotification = user.last_notification_time.toDate ?
    //         user.last_notification_time.toDate() :
    //         new Date(user.last_notification_time);

    //     const intervalHours = settings.notification_interval_hours || 2;
    //     const minInterval = intervalHours * 60 * 60 * 1000;
    //     const timeSinceLastNotification = Date.now() - lastNotification.getTime();

    //     if (timeSinceLastNotification < minInterval) {
    //         console.log(`⏰ User ${user.user_id} notification too soon`);
    //         return false;
    //     }
    // }

    return true;
}

/**
 * Отправить промо-уведомление одному пользователю
 */
async function sendPromoToUser(bot, user) {
    try {
        const language = user.language || 'en';
        const promo = getRandomPromo(language);
        const keyboard = getMainKeyboard(language);

        // Отправляем с картинкой
        if (promo.image) {
            await bot.telegram.sendPhoto(
                user.user_id,
                promo.image,
                {
                    caption: promo.text,
                    ...keyboard
                }
            );
        } else {
            await bot.telegram.sendMessage(
                user.user_id,
                promo.text,
                keyboard
            );
        }

        // Логируем отправку в БД
        await database.logNotification(user.user_id, {
            text: promo.text,
            media_url: promo.image,
            status: 'sent'
        });

        console.log(`✅ Promo sent to user ${user.user_id}`);
        return true;

    } catch (error) {
        console.error(`❌ Failed to send promo to ${user.user_id}:`, error.message);

        // Логируем ошибку
        await database.logNotification(user.user_id, {
            text: 'Failed to send',
            status: 'failed'
        });

        // Если пользователь заблокировал бота - отключаем уведомления
        if (error.message.includes('blocked') || error.message.includes('bot was blocked')) {
            await database.updateUser(user.user_id, {
                notifications_enabled: false
            });
            console.log(`🚫 User ${user.user_id} blocked bot, notifications disabled`);
        }

        return false;
    }
}

/**
 * Отправить промо всем подходящим пользователям
 */
export async function sendScheduledPromos(bot) {
    console.log('\n🚀 Starting scheduled promo notification round...');

    try {
        // Получаем настройки
        const settings = await database.getBotSettings();

        // Получаем всех пользователей с включенными уведомлениями
        const users = await database.getUsersWithNotifications();

        console.log(`📊 Found ${users.length} users with notifications enabled`);

        let sentCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        // Отправляем уведомления
        for (const user of users) {
            // Проверяем, можно ли отправить уведомление
            const canSend = await canSendNotification(user, settings);

            if (!canSend) {
                skippedCount++;
                continue;
            }

            // Отправляем промо
            const sent = await sendPromoToUser(bot, user);

            if (sent) {
                sentCount++;
            } else {
                failedCount++;
            }

            // Задержка между отправками (30 сообщений в секунду)
            if (sentCount % 30 === 0 && sentCount > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`\n✅ Promo round completed:`);
        console.log(`   📤 Sent: ${sentCount}`);
        console.log(`   ⏭️  Skipped: ${skippedCount}`);
        console.log(`   ❌ Failed: ${failedCount}`);
        console.log(`   👥 Total: ${users.length}`);

        return {
            sent: sentCount,
            skipped: skippedCount,
            failed: failedCount,
            total: users.length
        };

    } catch (error) {
        console.error('❌ Error in scheduled promo round:', error);
        return null;
    }
}

/**
 * Запустить планировщик уведомлений
 */
export function startNotificationScheduler(bot) {
    console.log('\n⏰ Starting notification scheduler...');

    // Получаем интервал из настроек (по умолчанию 2 часа)
    database.getBotSettings().then(settings => {
        // ⚠️ ТЕСТОВЫЙ РЕЖИМ: 1 минута
        // Раскомментируйте для продакшена:
        // const intervalHours = settings?.notification_interval_hours || 2;
        // const intervalMs = intervalHours * 60 * 60 * 1000;

        // 🧪 Для тестирования: 1 минута
        const intervalMinutes = 1;
        const intervalMs = intervalMinutes * 60 * 1000;

        console.log(`✅ Notification scheduler started (TEST MODE: ${intervalMinutes} minute)`);
        console.log(`   Next promo round: ${new Date(Date.now() + intervalMs).toLocaleString()}`);

        // Первая отправка через 10 секунд после запуска (для быстрого теста)
        setTimeout(() => {
            sendScheduledPromos(bot);
        }, 10 * 1000); // 10 секунд

        // Регулярная отправка каждую минуту
        setInterval(async () => {
            await sendScheduledPromos(bot);
        }, intervalMs);
    });
}

/**
 * Отправить тестовое промо администратору
 */
export async function sendTestPromo(bot, adminId, language) {
    try {
        const promo = getRandomPromo(language);
        const keyboard = getMainKeyboard(language);

        await bot.telegram.sendPhoto(
            adminId,
            promo.image,
            {
                caption: `🧪 TEST PROMO\n\n${promo.text}`,
                ...keyboard
            }
        );

        console.log(`✅ Test promo sent to admin ${adminId}`);
        return true;

    } catch (error) {
        console.error(`❌ Failed to send test promo:`, error);
        return false;
    }
}