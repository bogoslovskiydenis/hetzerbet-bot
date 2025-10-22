import { db } from '../firebase.js';
import admin from '../firebase.js';

export class Database {
    constructor() {
        this.usersCollection = db.collection('users');
        this.settingsCollection = db.collection('settings');
        this.broadcastsCollection = db.collection('broadcasts');
        this.notificationsCollection = db.collection('notifications');
        this.statsCollection = db.collection('statistics');
    }

    // ========== USERS ==========

    // Получить пользователя
    async getUser(userId) {
        try {
            const userDoc = await this.usersCollection.doc(userId.toString()).get();
            if (userDoc.exists) {
                console.log(`✅ User ${userId} found`);
                return userDoc.data();
            }
            console.log(`ℹ️ User ${userId} not found`);
            return null;
        } catch (error) {
            console.error('❌ Error getting user:', error);
            return null;
        }
    }

    // Создать нового пользователя
    async createUser(userId, userData) {
        try {
            await this.usersCollection.doc(userId.toString()).set({
                user_id: userId,
                username: userData.username || '',
                first_name: userData.first_name || '',
                language: null, // изначально null, выбирается после /start
                phone_number: null,
                is_subscribed: false,
                channel_subscription_verified: false,
                notifications_enabled: true,
                notifications_count: 0,
                last_notification_time: null,
                registration_date: admin.firestore.FieldValue.serverTimestamp(),
                last_activity: admin.firestore.FieldValue.serverTimestamp(),
                onboarding_completed: false,
                onboarding_step: 'language_selection',
            });
            console.log(`✅ User ${userId} created successfully`);
            return true;
        } catch (error) {
            console.error('❌ Error creating user:', error);
            return false;
        }
    }

    // Обновить пользователя
    async updateUser(userId, updates) {
        try {
            await this.usersCollection.doc(userId.toString()).update({
                ...updates,
                last_activity: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`✅ User ${userId} updated`);
            return true;
        } catch (error) {
            console.error('❌ Error updating user:', error);
            return false;
        }
    }

    // Получить всех пользователей
    async getAllUsers() {
        try {
            const snapshot = await this.usersCollection.get();
            const users = [];
            snapshot.forEach(doc => {
                users.push(doc.data());
            });
            console.log(`✅ Retrieved ${users.length} users`);
            return users;
        } catch (error) {
            console.error('❌ Error getting all users:', error);
            return [];
        }
    }

    // Получить пользователей по языку
    async getUsersByLanguage(language) {
        try {
            const snapshot = await this.usersCollection.where('language', '==', language).get();
            const users = [];
            snapshot.forEach(doc => {
                users.push(doc.data());
            });
            console.log(`✅ Retrieved ${users.length} users with language: ${language}`);
            return users;
        } catch (error) {
            console.error('❌ Error getting users by language:', error);
            return [];
        }
    }

    // Получить пользователей с включенными уведомлениями
    async getUsersWithNotifications(language = null) {
        try {
            // Временно для теста - возвращаем ВСЕХ пользователей
            let query = this.usersCollection;
            // let query = this.usersCollection.where('notifications_enabled', '==', true);

            if (language) {
                query = query.where('language', '==', language);
            }

            const snapshot = await query.get();
            const users = [];
            snapshot.forEach(doc => {
                users.push(doc.data());
            });
            console.log(`✅ Retrieved ${users.length} users (TEST MODE - all users)`);
            return users;
        } catch (error) {
            console.error('❌ Error getting users with notifications:', error);
            return [];
        }
    }

    // ========== SETTINGS ==========

    // Получить настройки бота
    async getBotSettings() {
        try {
            const settingsDoc = await this.settingsCollection.doc('bot_config').get();

            if (settingsDoc.exists) {
                return settingsDoc.data();
            }

            console.log('⚠️ Settings not found, creating default...');
            await this.createDefaultSettings();
            return await this.getBotSettings();
        } catch (error) {
            console.error('❌ Error getting settings:', error);
            return null;
        }
    }

    // Создать дефолтные настройки
    async createDefaultSettings() {
        try {
            const defaultSettings = {
                phone_number_required: false,
                notification_interval_hours: 2,
                notification_interval_minutes: 120, // 2 часа в минутах
                notification_schedule: {
                    enabled: true,
                    quiet_hours_start: 23,
                    quiet_hours_end: 8,
                    max_per_day: 12
                },
                channel_id: '@hertzbet_channel',
                channel_username: 'hertzbet_channel',
                welcome_image_url: 'https://example.com/welcome.jpg',
                welcome_text: {
                    de: '🎰 Willkommen bei Hertzbet!\n\n✨ Tausende von Spielen\n💰 Willkommensbonus\n🎁 Cashback & Free Spins\n⚡️ Schnelle Auszahlungen\n🏆 VIP-Programm\n💬 24/7 Support',
                    en: '🎰 Welcome to Hertzbet!\n\n✨ Thousands of games\n💰 Welcome bonus\n🎁 Cashback & Free Spins\n⚡️ Fast withdrawals\n🏆 VIP Program\n💬 24/7 Support'
                },
                admin_ids: [5230934145],
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };

            await this.settingsCollection.doc('bot_config').set(defaultSettings);
            console.log('✅ Default settings created');
            return true;
        } catch (error) {
            console.error('❌ Error creating default settings:', error);
            return false;
        }
    }

    // Обновить настройки
    async updateSettings(updates) {
        try {
            await this.settingsCollection.doc('bot_config').update({
                ...updates,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Settings updated');
            return true;
        } catch (error) {
            console.error('❌ Error updating settings:', error);
            return false;
        }
    }



    // Добавить админа
    async addAdmin(userId) {
        try {
            const settings = await this.getBotSettings();
            if (!settings.admin_ids.includes(userId)) {
                settings.admin_ids.push(userId);
                await this.updateSettings({ admin_ids: settings.admin_ids });
                console.log(`✅ Admin ${userId} added`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error adding admin:', error);
            return false;
        }
    }

    // Удалить админа
    async removeAdmin(userId) {
        try {
            const settings = await this.getBotSettings();
            const newAdmins = settings.admin_ids.filter(id => id !== userId);
            await this.updateSettings({ admin_ids: newAdmins });
            console.log(`✅ Admin ${userId} removed`);
            return true;
        } catch (error) {
            console.error('❌ Error removing admin:', error);
            return false;
        }
    }

    // ========== STATISTICS ==========

    // Получить общее количество пользователей
    async getTotalUsers() {
        try {
            const snapshot = await this.usersCollection.count().get();
            return snapshot.data().count;
        } catch (error) {
            console.error('❌ Error getting total users:', error);
            return 0;
        }
    }

    // Получить новых пользователей за период
    async getNewUsersInPeriod(startDate, endDate) {
        try {
            const snapshot = await this.usersCollection
                .where('registration_date', '>=', startDate)
                .where('registration_date', '<=', endDate)
                .get();

            return snapshot.size;
        } catch (error) {
            console.error('❌ Error getting new users in period:', error);
            return 0;
        }
    }

    // Получить статистику по языкам
    async getLanguageStats() {
        try {
            const allUsers = await this.getAllUsers();
            const stats = {
                de: 0,
                en: 0,
                null: 0
            };

            allUsers.forEach(user => {
                const lang = user.language || 'null';
                stats[lang] = (stats[lang] || 0) + 1;
            });

            return stats;
        } catch (error) {
            console.error('❌ Error getting language stats:', error);
            return { de: 0, en: 0, null: 0 };
        }
    }

    // Получить статистику за текущую неделю (понедельник-воскресенье)
    async getWeeklyStats() {
        try {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // понедельник = 0

            const monday = new Date(now);
            monday.setDate(now.getDate() - diff);
            monday.setHours(0, 0, 0, 0);

            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            sunday.setHours(23, 59, 59, 999);

            return await this.getNewUsersInPeriod(monday, sunday);
        } catch (error) {
            console.error('❌ Error getting weekly stats:', error);
            return 0;
        }
    }

    // Получить статистику за текущий месяц
    async getCurrentMonthStats() {
        try {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

            return await this.getNewUsersInPeriod(firstDay, lastDay);
        } catch (error) {
            console.error('❌ Error getting current month stats:', error);
            return 0;
        }
    }

    // Получить статистику за прошлый месяц
    async getLastMonthStats() {
        try {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

            return await this.getNewUsersInPeriod(firstDay, lastDay);
        } catch (error) {
            console.error('❌ Error getting last month stats:', error);
            return 0;
        }
    }

    // Получить полную статистику
    async getFullStats() {
        try {
            const [total, weekly, monthly, lastMonth, langStats] = await Promise.all([
                this.getTotalUsers(),
                this.getWeeklyStats(),
                this.getCurrentMonthStats(),
                this.getLastMonthStats(),
                this.getLanguageStats()
            ]);

            return {
                total_users: total,
                new_this_week: weekly,
                new_this_month: monthly,
                new_last_month: lastMonth,
                by_language: langStats
            };
        } catch (error) {
            console.error('❌ Error getting full stats:', error);
            return null;
        }
    }

    // ========== BROADCASTS ==========

    // Создать рассылку
    async createBroadcast(broadcastData) {
        try {
            const broadcastRef = await this.broadcastsCollection.add({
                text: broadcastData.text,
                media_url: broadcastData.media_url || null,
                media_type: broadcastData.media_type || null,
                buttons: broadcastData.buttons || [],
                target_language: broadcastData.target_language || 'all', // all, de, en
                status: 'pending', // pending, in_progress, completed, failed
                sent_count: 0,
                failed_count: 0,
                total_count: 0,
                created_by: broadcastData.admin_id,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                started_at: null,
                completed_at: null
            });

            console.log(`✅ Broadcast ${broadcastRef.id} created`);
            return broadcastRef.id;
        } catch (error) {
            console.error('❌ Error creating broadcast:', error);
            return null;
        }
    }

    // Обновить статус рассылки
    async updateBroadcast(broadcastId, updates) {
        try {
            await this.broadcastsCollection.doc(broadcastId).update(updates);
            console.log(`✅ Broadcast ${broadcastId} updated`);
            return true;
        } catch (error) {
            console.error('❌ Error updating broadcast:', error);
            return false;
        }
    }

    // Получить рассылку
    async getBroadcast(broadcastId) {
        try {
            const doc = await this.broadcastsCollection.doc(broadcastId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('❌ Error getting broadcast:', error);
            return null;
        }
    }

    // ========== NOTIFICATIONS ==========

    // Сохранить отправленное уведомление
    async logNotification(userId, notificationData) {
        try {
            await this.notificationsCollection.add({
                user_id: userId,
                text: notificationData.text,
                media_url: notificationData.media_url || null,
                sent_at: admin.firestore.FieldValue.serverTimestamp(),
                status: notificationData.status || 'sent'
            });

            // Обновляем счетчик у пользователя
            await this.updateUser(userId, {
                notifications_count: admin.firestore.FieldValue.increment(1),
                last_notification_time: admin.firestore.FieldValue.serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('❌ Error logging notification:', error);
            return false;
        }
    }

    // Получить количество уведомлений за сегодня для пользователя
    async getTodayNotificationCount(userId) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const snapshot = await this.notificationsCollection
                .where('user_id', '==', userId)
                .where('sent_at', '>=', today)
                .get();

            return snapshot.size;
        } catch (error) {
            console.error('❌ Error getting today notification count:', error);
            return 0;
        }
    }

    // ========== UTILITY ==========

    // Тестовая функция - проверка подключения
    async testConnection() {
        try {
            await this.usersCollection.doc('test').set({
                test: true,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log('✅ Firebase connection test: SUCCESS');

            await this.usersCollection.doc('test').delete();
            return true;
        } catch (error) {
            console.error('❌ Firebase connection test: FAILED', error);
            return false;
        }
    }

    // В методе isAdmin добавьте логирование:
    async isAdmin(userId) {
        try {
            const settings = await this.getBotSettings();
            console.log('🔍 DEBUG isAdmin:');
            console.log('   Checking userId:', userId);
            console.log('   admin_ids from DB:', settings?.admin_ids);
            console.log('   Includes?', settings?.admin_ids?.includes(userId));
            return settings?.admin_ids?.includes(userId) || false;
        } catch (error) {
            console.error('❌ Error checking admin:', error);
            return false;
        }
    }


    // ========== SCHEDULED BROADCASTS ==========

    /**
     * Получить все запланированные рассылки (статус 'scheduled')
     */
    async getScheduledBroadcasts() {
        try {
            const snapshot = await this.broadcastsCollection
                .where('status', '==', 'scheduled')
                .orderBy('scheduled_time', 'asc')
                .get();

            const broadcasts = [];
            snapshot.forEach(doc => {
                broadcasts.push({ id: doc.id, ...doc.data() });
            });

            console.log(`✅ Retrieved ${broadcasts.length} scheduled broadcasts`);
            return broadcasts;
        } catch (error) {
            console.error('❌ Error getting scheduled broadcasts:', error);
            return [];
        }
    }

    /**
     * Получить все запланированные рассылки для админа (для просмотра)
     */
    async getAllScheduledBroadcasts() {
        try {
            const snapshot = await this.broadcastsCollection
                .where('status', '==', 'scheduled')
                .orderBy('scheduled_time', 'asc')
                .get();

            const broadcasts = [];
            snapshot.forEach(doc => {
                broadcasts.push({ id: doc.id, ...doc.data() });
            });

            return broadcasts;
        } catch (error) {
            console.error('❌ Error getting all scheduled broadcasts:', error);
            return [];
        }
    }

    /**
     * Отменить (удалить) запланированную рассылку
     */
    async cancelScheduledBroadcast(broadcastId) {
        try {
            const broadcast = await this.getBroadcast(broadcastId);

            if (!broadcast) {
                console.log(`⚠️ Broadcast ${broadcastId} not found`);
                return false;
            }

            if (broadcast.status !== 'scheduled') {
                console.log(`⚠️ Broadcast ${broadcastId} is not scheduled (status: ${broadcast.status})`);
                return false;
            }

            // Обновляем статус на cancelled
            await this.broadcastsCollection.doc(broadcastId).update({
                status: 'cancelled',
                cancelled_at: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Broadcast ${broadcastId} cancelled`);
            return true;
        } catch (error) {
            console.error('❌ Error cancelling broadcast:', error);
            return false;
        }
    }

    async createScheduledBroadcast(broadcastData) {
        try {
            const broadcastRef = await this.broadcastsCollection.add({
                text: broadcastData.text,
                media_url: broadcastData.media_url || null,
                media_type: broadcastData.media_type || null,
                buttons: broadcastData.buttons || [],
                target_language: broadcastData.target_language || 'all',
                status: 'scheduled',
                is_scheduled: true,
                scheduled_time: broadcastData.scheduled_time,
                sent_count: 0,
                failed_count: 0,
                total_count: 0,
                created_by: broadcastData.admin_id,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                started_at: null,
                completed_at: null,
                cancelled_at: null
            });

            console.log(`✅ Scheduled broadcast ${broadcastRef.id} created`);
            return broadcastRef.id;
        } catch (error) {
            console.error('❌ Error creating scheduled broadcast:', error);
            return null;
        }
    }

    // ========== NOTIFICATION TEMPLATES ==========

    /**
     * Создать шаблон уведомления
     */
    async createNotificationTemplate(templateData) {
        try {
            const templateRef = await this.notificationsCollection.add({
                name: templateData.name,
                text_de: templateData.text_de,
                text_en: templateData.text_en,
                image_url: templateData.image_url || null,
                buttons: templateData.buttons || [],
                is_active: templateData.is_active !== false, // по умолчанию активен
                created_by: templateData.admin_id,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Notification template ${templateRef.id} created`);
            return templateRef.id;
        } catch (error) {
            console.error('❌ Error creating notification template:', error);
            return null;
        }
    }

    /**
     * Получить все шаблоны уведомлений
     */
    async getNotificationTemplates() {
        try {
            const snapshot = await this.notificationsCollection
                .where('is_active', '==', true)
                .get();

            const templates = [];
            snapshot.forEach(doc => {
                templates.push({ id: doc.id, ...doc.data() });
            });

            // Сортируем в коде вместо orderBy в запросе
            templates.sort((a, b) => b.created_at - a.created_at);

            console.log(`✅ Retrieved ${templates.length} notification templates`);
            return templates;
        } catch (error) {
            console.error('❌ Error getting notification templates:', error);
            return [];
        }
    }

    /**
     * Получить шаблон уведомления по ID
     */
    async getNotificationTemplate(templateId) {
        try {
            const doc = await this.notificationsCollection.doc(templateId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('❌ Error getting notification template:', error);
            return null;
        }
    }

    /**
     * Обновить шаблон уведомления
     */
    async updateNotificationTemplate(templateId, updates) {
        try {
            await this.notificationsCollection.doc(templateId).update({
                ...updates,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ Notification template ${templateId} updated`);
            return true;
        } catch (error) {
            console.error('❌ Error updating notification template:', error);
            return false;
        }
    }

    /**
     * Удалить шаблон уведомления
     */
    async deleteNotificationTemplate(templateId) {
        try {
            await this.notificationsCollection.doc(templateId).update({
                is_active: false,
                deleted_at: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ Notification template ${templateId} deleted`);
            return true;
        } catch (error) {
            console.error('❌ Error deleting notification template:', error);
            return false;
        }
    }

    /**
     * Получить случайный активный шаблон уведомления
     */
    async getRandomNotificationTemplate(language = 'en') {
        try {
            const templates = await this.getNotificationTemplates();
            
            if (templates.length === 0) {
                console.log('⚠️ No active notification templates found');
                return null;
            }

            const randomIndex = Math.floor(Math.random() * templates.length);
            const template = templates[randomIndex];

            return {
                text: template[`text_${language}`] || template.text_en,
                image_url: template.image_url,
                buttons: template.buttons || []
            };
        } catch (error) {
            console.error('❌ Error getting random notification template:', error);
            return null;
        }
    }
}

export const database = new Database();