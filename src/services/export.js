import ExcelJS from 'exceljs';
import { database } from '../config/services/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Папка для временных файлов
const TEMP_DIR = path.join(__dirname, '../../temp');

// Создаем папку temp если её нет
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Форматировать дату для отображения
 */
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';

    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Invalid Date';
    }
}

/**
 * Экспорт в Excel (.xlsx)
 */
export async function exportToExcel() {
    console.log('📊 Starting Excel export...');

    try {
        // Получаем всех пользователей
        const users = await database.getAllUsers();

        if (!users || users.length === 0) {
            throw new Error('No users found');
        }

        // Создаем новую рабочую книгу
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users');

        // Настройка заголовков
        worksheet.columns = [
            { header: 'User ID', key: 'user_id', width: 15 },
            { header: 'Username', key: 'username', width: 20 },
            { header: 'First Name', key: 'first_name', width: 20 },
            { header: 'Language', key: 'language', width: 12 },
            { header: 'Phone Number', key: 'phone_number', width: 18 },
            { header: 'Subscribed', key: 'is_subscribed', width: 12 },
            { header: 'Notifications', key: 'notifications_enabled', width: 15 },
            { header: 'Notifications Count', key: 'notifications_count', width: 18 },
            { header: 'Registration Date', key: 'registration_date', width: 20 },
            { header: 'Last Activity', key: 'last_activity', width: 20 },
            { header: 'Onboarding Completed', key: 'onboarding_completed', width: 20 },
            { header: 'Onboarding Step', key: 'onboarding_step', width: 20 }
        ];

        // Стилизация заголовков
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Добавляем данные пользователей
        users.forEach(user => {
            worksheet.addRow({
                user_id: user.user_id,
                username: user.username || 'N/A',
                first_name: user.first_name || 'N/A',
                language: user.language || 'Not set',
                phone_number: user.phone_number || 'N/A',
                is_subscribed: user.is_subscribed ? 'Yes' : 'No',
                notifications_enabled: user.notifications_enabled ? 'Yes' : 'No',
                notifications_count: user.notifications_count || 0,
                registration_date: formatDate(user.registration_date),
                last_activity: formatDate(user.last_activity),
                onboarding_completed: user.onboarding_completed ? 'Yes' : 'No',
                onboarding_step: user.onboarding_step || 'N/A'
            });
        });

        // Автоподбор ширины (опционально)
        worksheet.columns.forEach(column => {
            column.alignment = { vertical: 'middle', horizontal: 'left' };
        });

        // Сохраняем файл
        const filename = `users_export_${Date.now()}.xlsx`;
        const filepath = path.join(TEMP_DIR, filename);

        await workbook.xlsx.writeFile(filepath);

        console.log(`✅ Excel file created: ${filename}`);
        console.log(`   Total users: ${users.length}`);

        return {
            success: true,
            filepath,
            filename,
            count: users.length
        };

    } catch (error) {
        console.error('❌ Error creating Excel file:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Экспорт в CSV
 */
export async function exportToCSV() {
    console.log('📄 Starting CSV export...');

    try {
        // Получаем всех пользователей
        const users = await database.getAllUsers();

        if (!users || users.length === 0) {
            throw new Error('No users found');
        }

        // Заголовки CSV
        const headers = [
            'User ID',
            'Username',
            'First Name',
            'Language',
            'Phone Number',
            'Subscribed',
            'Notifications',
            'Notifications Count',
            'Registration Date',
            'Last Activity',
            'Onboarding Completed',
            'Onboarding Step'
        ];

        // Формируем строки CSV
        const rows = users.map(user => [
            user.user_id,
            user.username || 'N/A',
            user.first_name || 'N/A',
            user.language || 'Not set',
            user.phone_number || 'N/A',
            user.is_subscribed ? 'Yes' : 'No',
            user.notifications_enabled ? 'Yes' : 'No',
            user.notifications_count || 0,
            formatDate(user.registration_date),
            formatDate(user.last_activity),
            user.onboarding_completed ? 'Yes' : 'No',
            user.onboarding_step || 'N/A'
        ]);

        // Создаем CSV контент
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => {
                // Экранируем запятые и кавычки
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(','))
        ].join('\n');

        // Сохраняем файл
        const filename = `users_export_${Date.now()}.csv`;
        const filepath = path.join(TEMP_DIR, filename);

        fs.writeFileSync(filepath, '\ufeff' + csvContent, 'utf8'); // BOM для правильного отображения в Excel

        console.log(`✅ CSV file created: ${filename}`);
        console.log(`   Total users: ${users.length}`);

        return {
            success: true,
            filepath,
            filename,
            count: users.length
        };

    } catch (error) {
        console.error('❌ Error creating CSV file:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Экспорт списка usernames
 */
export async function exportUsernames() {
    console.log('👤 Starting usernames export...');

    try {
        // Получаем всех пользователей
        const users = await database.getAllUsers();

        if (!users || users.length === 0) {
            throw new Error('No users found');
        }

        // Фильтруем и собираем usernames
        const usernames = users
            .filter(user => user.username) // Только те, у кого есть username
            .map(user => `@${user.username}`)
            .sort(); // Сортируем по алфавиту

        // Создаем текстовый файл
        const content = usernames.join('\n');

        const filename = `usernames_${Date.now()}.txt`;
        const filepath = path.join(TEMP_DIR, filename);

        fs.writeFileSync(filepath, content, 'utf8');

        console.log(`✅ Usernames file created: ${filename}`);
        console.log(`   Total usernames: ${usernames.length}`);
        console.log(`   Total users: ${users.length}`);

        return {
            success: true,
            filepath,
            filename,
            count: usernames.length,
            total: users.length
        };

    } catch (error) {
        console.error('❌ Error creating usernames file:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Экспорт списка User IDs
 */
export async function exportUserIds() {
    console.log('🆔 Starting user IDs export...');

    try {
        // Получаем всех пользователей
        const users = await database.getAllUsers();

        if (!users || users.length === 0) {
            throw new Error('No users found');
        }

        // Собираем user IDs
        const userIds = users
            .map(user => user.user_id)
            .sort((a, b) => a - b); // Сортируем по возрастанию

        // Создаем текстовый файл
        const content = userIds.join('\n');

        const filename = `user_ids_${Date.now()}.txt`;
        const filepath = path.join(TEMP_DIR, filename);

        fs.writeFileSync(filepath, content, 'utf8');

        console.log(`✅ User IDs file created: ${filename}`);
        console.log(`   Total user IDs: ${userIds.length}`);

        return {
            success: true,
            filepath,
            filename,
            count: userIds.length
        };

    } catch (error) {
        console.error('❌ Error creating user IDs file:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Удалить временный файл после отправки
 */
export function cleanupFile(filepath) {
    try {
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            console.log(`🗑️ Cleaned up: ${path.basename(filepath)}`);
        }
    } catch (error) {
        console.error('❌ Error cleaning up file:', error);
    }
}

/**
 * Очистить все старые файлы (старше 1 часа)
 */
export function cleanupOldFiles() {
    try {
        const files = fs.readdirSync(TEMP_DIR);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        files.forEach(file => {
            const filepath = path.join(TEMP_DIR, file);
            const stats = fs.statSync(filepath);
            const age = now - stats.mtimeMs;

            if (age > oneHour) {
                fs.unlinkSync(filepath);
                console.log(`🗑️ Cleaned up old file: ${file}`);
            }
        });
    } catch (error) {
        console.error('❌ Error cleaning up old files:', error);
    }
}