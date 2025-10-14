import { db } from './firebase.js';
import admin from '../config/firebase.js';

export class Database {
    constructor() {
        this.usersCollection = db.collection('users');
        this.settingsCollection = db.collection('settings');
    }

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
                language: userData.language || 'en',
                phone_number: userData.phone_number || null,
                is_subscribed: false,
                notifications_enabled: true,
                registration_date: admin.firestore.FieldValue.serverTimestamp(),
                last_activity: admin.firestore.FieldValue.serverTimestamp(),
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

    // Тестовая функция - проверка подключения
    async testConnection() {
        try {
            const testDoc = await this.usersCollection.doc('test').set({
                test: true,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log('✅ Firebase connection test: SUCCESS');

            // Удаляем тестовый документ
            await this.usersCollection.doc('test').delete();
            return true;
        } catch (error) {
            console.error('❌ Firebase connection test: FAILED', error);
            return false;
        }
    }
}

export const database = new Database();