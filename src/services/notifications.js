import { Markup } from 'telegraf';
import { database } from '../config/services/database.js';
import { t } from '../locales/i18n.js';
import { getMainKeyboard } from '../utils/keyboards.js';

/**
 * Получить случайное промо-сообщение из БД
 */
async function getRandomPromo(language) {
    try {
        const template = await database.getRandomNotificationTemplate(language);
        
        if (template) {
            return {
                text: template.text,
                image: template.image_url,
                buttons: template.buttons || []
            };
        }
        
        // Если нет шаблонов в БД - возвращаем null, чтобы пропустить отправку
        console.log('⚠️ No notification templates in DB, please create some via admin panel');
        return null;
        
    } catch (error) {
        console.error('❌ Error getting random promo:', error);
        return {
            text: `❌ Ошибка загрузки уведомлений\n\nПожалуйста, обратитесь к администратору`,
            image: null
        };
    }
}

/**
 * Проверить, можно ли отправить уведомление пользователю
 */
async function canSendNotification(user, settings) {
    // Проверка 1: Включены ли уведомления у пользователя
    // if (!user.notifications_enabled) {
    //     return false;
    // }
    //
    // // Проверка 2: Тихие часы (quiet hours) - ОТКЛЮЧЕНО ДЛЯ ТЕСТА
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
        const promo = await getRandomPromo(language);

        // Если нет промо-шаблонов, пропускаем отправку
        if (!promo) {
            console.log(`⏭️ No promo templates available, skipping user ${user.user_id}`);
            return false;
        }

        // Создаем клавиатуру из кнопок шаблона
        let keyboard = null;
        if (promo.buttons && promo.buttons.length > 0) {
            keyboard = Markup.inlineKeyboard(
                promo.buttons.map(btn => [Markup.button.url(btn.text, btn.url)])
            );
        }

        // Отправляем с картинкой
        if (promo.image) {
            await bot.telegram.sendPhoto(
                user.user_id,
                promo.image,
                {
                    caption: promo.text,
                    ...(keyboard || {})
                }
            );
        } else {
            await bot.telegram.sendMessage(
                user.user_id,
                promo.text,
                keyboard || {}
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

        // Проверяем, есть ли шаблоны уведомлений
        const templates = await database.getNotificationTemplates();
        if (templates.length === 0) {
            console.log('⚠️ No notification templates found, skipping promo round');
            return {
                sent: 0,
                skipped: 0,
                failed: 0,
                total: 0
            };
        }

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

// Глобальная переменная для хранения интервала
let notificationInterval = null;

/**
 * Запустить планировщик уведомлений
 */
export function startNotificationScheduler(bot) {
    console.log('\n⏰ Starting notification scheduler...');

    // Останавливаем предыдущий интервал если есть
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }

    // Получаем интервал из настроек
    database.getBotSettings().then(settings => {
        // Используем интервал в минутах, если он задан, иначе используем часы
        const intervalMinutes = settings?.notification_interval_minutes || (settings?.notification_interval_hours || 2) * 60;
        const intervalMs = intervalMinutes * 60 * 1000;

        console.log(`✅ Notification scheduler started`);
        console.log(`   Interval: ${intervalMinutes} minutes`);
        console.log(`   Next promo round: ${new Date(Date.now() + intervalMs).toLocaleString()}`);

        // Первая отправка через 30 секунд после запуска
        setTimeout(() => {
            sendScheduledPromos(bot);
        }, 30 * 1000);

        // Регулярная отправка по настроенному интервалу
        notificationInterval = setInterval(async () => {
            await sendScheduledPromos(bot);
        }, intervalMs);
    });
}

/**
 * Остановить планировщик уведомлений
 */
export function stopNotificationScheduler() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
        console.log('⏹️ Notification scheduler stopped');
    }
}

/**
 * Отправить тестовое промо администратору
 */
export async function sendTestPromo(bot, adminId, language) {
    try {
        const promo = await getRandomPromo(language);
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