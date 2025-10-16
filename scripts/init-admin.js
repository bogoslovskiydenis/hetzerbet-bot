import dotenv from 'dotenv';
import '../src/config/firebase.js';
import { database } from '../src/config/services/database.js';

dotenv.config();

/**
 * Скрипт для инициализации админов
 */
async function initAdmin() {
    console.log('\n🔐 Initializing admin access...\n');

    try {
        // ID админов
        const adminIds = [
            5230934145,  // Denis
            1099861998   // Shark
        ];

        console.log('👥 Admin IDs to add:', adminIds);

        // Получаем текущие настройки
        let settings = await database.getBotSettings();

        if (!settings) {
            console.log('⚠️  Settings not found, creating default...');
            await database.createDefaultSettings();
            settings = await database.getBotSettings();
        }

        console.log('📋 Current admin_ids:', settings.admin_ids || []);

        // Объединяем существующие и новые ID (без дубликатов)
        const currentAdmins = settings.admin_ids || [];
        const newAdminIds = [...new Set([...currentAdmins, ...adminIds])];

        // Обновляем настройки
        await database.updateSettings({
            admin_ids: newAdminIds
        });

        console.log('✅ Admin IDs updated:', newAdminIds);
        console.log('\n🎉 Admin initialization completed!\n');

        // Проверяем доступ для каждого админа
        console.log('🔍 Verifying admin access:\n');
        for (const userId of newAdminIds) {
            const isAdmin = await database.isAdmin(userId);
            console.log(`   User ${userId}: ${isAdmin ? '✅ HAS ACCESS' : '❌ NO ACCESS'}`);
        }

        console.log('\n✨ Done! You can now use /admin command\n');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error initializing admin:', error);
        process.exit(1);
    }
}

// Запускаем скрипт
initAdmin();