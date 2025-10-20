import { Markup } from 'telegraf';
import { database } from '../config/services/database.js';
import { t } from '../locales/i18n.js';

/**
 * Планировщик отложенных рассылок
 */
class BroadcastScheduler {
    constructor() {
        this.bot = null;
        this.checkInterval = null;
        this.isRunning = false;
    }

    /**
     * Запустить планировщик
     */
    start(bot) {
        if (this.isRunning) {
            console.log('⚠️ Broadcast scheduler already running');
            return;
        }

        this.bot = bot;
        this.isRunning = true;

        console.log('📅 Broadcast scheduler started');
        console.log('   Adaptive checking: 30 sec if broadcast within 10 min, else 5 min');

        // Адаптивная проверка
        this.checkInterval = setInterval(async () => {
            await this.adaptiveCheck();
        }, 30 * 1000); // Проверяем каждые 30 секунд

        // Первая проверка сразу при запуске
        setTimeout(() => {
            this.adaptiveCheck();
        }, 5000);
    }

    async adaptiveCheck() {
        try {
            const scheduledBroadcasts = await database.getScheduledBroadcasts();

            if (!scheduledBroadcasts || scheduledBroadcasts.length === 0) {
                // Если нет запланированных - проверяем раз в 5 минут
                return;
            }

            const now = new Date();
            let nearestBroadcast = null;
            let minTimeLeft = Infinity;

            // Находим ближайшую рассылку
            for (const broadcast of scheduledBroadcasts) {
                const scheduledTime = broadcast.scheduled_time.toDate ?
                    broadcast.scheduled_time.toDate() :
                    new Date(broadcast.scheduled_time);

                const timeLeft = scheduledTime - now;

                if (timeLeft < minTimeLeft) {
                    minTimeLeft = timeLeft;
                    nearestBroadcast = broadcast;
                }
            }

            // Если ближайшая рассылка в пределах 10 минут - проверяем детально
            if (minTimeLeft <= 10 * 60 * 1000) {
                console.log(`\n🔍 Checking scheduled broadcasts at ${now.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`);
                await this.checkAndSendScheduledBroadcasts();
            } else {
                // Просто показываем что есть запланированные рассылки
                const minutesLeft = Math.round(minTimeLeft / 1000 / 60);
                console.log(`⏰ Next broadcast in ${minutesLeft} minutes (ID: ${nearestBroadcast.id})`);
            }

        } catch (error) {
            console.error('❌ Error in adaptive check:', error);
        }
    }


    /**
     * Остановить планировщик
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isRunning = false;
        console.log('⏹️ Broadcast scheduler stopped');
    }

    /**
     * Проверить и отправить запланированные рассылки
     */
    async checkAndSendScheduledBroadcasts() {
        try {
            const now = new Date();
            console.log(`\n🔍 Checking scheduled broadcasts at ${now.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`);

            // Получаем все запланированные рассылки
            const scheduledBroadcasts = await database.getScheduledBroadcasts();

            if (!scheduledBroadcasts || scheduledBroadcasts.length === 0) {
                console.log('   No scheduled broadcasts found');
                return;
            }

            console.log(`   Found ${scheduledBroadcasts.length} scheduled broadcast(s)`);

            for (const broadcast of scheduledBroadcasts) {
                const scheduledTime = broadcast.scheduled_time.toDate ?
                    broadcast.scheduled_time.toDate() :
                    new Date(broadcast.scheduled_time);

                // Проверяем, не пора ли отправить
                if (scheduledTime <= now) {
                    console.log(`\n📤 Time to send broadcast ${broadcast.id}`);
                    await this.sendScheduledBroadcast(broadcast);
                } else {
                    const minutesLeft = Math.round((scheduledTime - now) / 1000 / 60);
                    console.log(`   Broadcast ${broadcast.id} scheduled in ${minutesLeft} minutes`);
                }
            }

        } catch (error) {
            console.error('❌ Error checking scheduled broadcasts:', error);
        }
    }

    /**
     * Отправить запланированную рассылку
     */
    async sendScheduledBroadcast(broadcast) {
        try {
            console.log(`📢 Starting scheduled broadcast ${broadcast.id}`);

            // Обновляем статус на "in_progress"
            await database.updateBroadcast(broadcast.id, {
                status: 'in_progress',
                started_at: new Date()
            });

            // Получаем целевую аудиторию
            let targetUsers = [];
            if (broadcast.target_language === 'all') {
                targetUsers = await database.getUsersWithNotifications();
            } else {
                targetUsers = await database.getUsersWithNotifications(broadcast.target_language);
            }

            console.log(`   Target audience: ${targetUsers.length} users`);

            // Обновляем total_count
            await database.updateBroadcast(broadcast.id, {
                total_count: targetUsers.length
            });

            // Формируем кнопки если есть
            let buttonsKeyboard = null;
            if (broadcast.buttons && broadcast.buttons.length > 0) {
                const buttonRows = [];
                for (const btn of broadcast.buttons) {
                    buttonRows.push([Markup.button.url(btn.text, btn.url)]);
                }
                buttonsKeyboard = Markup.inlineKeyboard(buttonRows);
            }

            // Отправляем рассылку
            let sentCount = 0;
            let failedCount = 0;

            for (let i = 0; i < targetUsers.length; i++) {
                const user = targetUsers[i];

                try {
                    // Отправляем сообщение
                    if (broadcast.media_url) {
                        if (broadcast.media_type === 'photo') {
                            await this.bot.telegram.sendPhoto(user.user_id, broadcast.media_url, {
                                caption: broadcast.text,
                                ...buttonsKeyboard
                            });
                        } else if (broadcast.media_type === 'video') {
                            await this.bot.telegram.sendVideo(user.user_id, broadcast.media_url, {
                                caption: broadcast.text,
                                ...buttonsKeyboard
                            });
                        } else if (broadcast.media_type === 'animation') {
                            await this.bot.telegram.sendAnimation(user.user_id, broadcast.media_url, {
                                caption: broadcast.text,
                                ...buttonsKeyboard
                            });
                        }
                    } else {
                        await this.bot.telegram.sendMessage(user.user_id, broadcast.text, buttonsKeyboard);
                    }

                    sentCount++;

                    // Задержка для избежания блокировок (30 сообщений в секунду)
                    if (i % 30 === 0 && i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                } catch (error) {
                    console.error(`   Failed to send to ${user.user_id}:`, error.message);
                    failedCount++;

                    // Если пользователь заблокировал бота
                    if (error.message.includes('blocked') || error.message.includes('bot was blocked')) {
                        await database.updateUser(user.user_id, {
                            notifications_enabled: false
                        });
                    }
                }

                // Обновляем прогресс каждые 50 пользователей
                if (i % 50 === 0 && i > 0) {
                    await database.updateBroadcast(broadcast.id, {
                        sent_count: sentCount,
                        failed_count: failedCount
                    });
                }
            }

            // Финальное обновление статуса
            await database.updateBroadcast(broadcast.id, {
                status: 'completed',
                sent_count: sentCount,
                failed_count: failedCount,
                completed_at: new Date()
            });

            console.log(`✅ Scheduled broadcast ${broadcast.id} completed:`);
            console.log(`   Sent: ${sentCount}/${targetUsers.length}`);
            console.log(`   Failed: ${failedCount}`);

            // Уведомляем администратора об отправке
            try {
                const adminId = broadcast.created_by;
                const user = await database.getUser(adminId);
                const lang = user?.language || 'en';

                await this.bot.telegram.sendMessage(
                    adminId,
                    `✅ ${t('admin.broadcast.scheduled_completed', lang)}\n\n` +
                    `📤 ${t('admin.broadcast.sent', lang)}: ${sentCount}\n` +
                    `❌ ${t('admin.broadcast.failed', lang)}: ${failedCount}\n` +
                    `👥 ${t('admin.broadcast.total', lang)}: ${targetUsers.length}\n\n` +
                    `🕐 ${t('admin.broadcast.scheduled_time', lang)}: ${broadcast.scheduled_time.toDate().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`
                );
            } catch (error) {
                console.error('   Failed to notify admin:', error.message);
            }

        } catch (error) {
            console.error(`❌ Error sending scheduled broadcast ${broadcast.id}:`, error);

            // Обновляем статус на failed
            await database.updateBroadcast(broadcast.id, {
                status: 'failed',
                completed_at: new Date()
            });
        }
    }

    /**
     * Получить статистику планировщика
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            hasBot: this.bot !== null
        };
    }
}

// Создаем singleton
export const broadcastScheduler = new BroadcastScheduler();

/**
 * Запустить планировщик рассылок
 */
export function startBroadcastScheduler(bot) {
    broadcastScheduler.start(bot);
}

/**
 * Остановить планировщик рассылок
 */
export function stopBroadcastScheduler() {
    broadcastScheduler.stop();
}