import { database } from '../../config/services/database.js';
import { t } from '../../locales/i18n.js';
import { getExportKeyboard, getBackButton } from '../../utils/keyboards.js';
import { adminMiddleware } from './index.js';
import {
    exportToExcel,
    exportToCSV,
    exportUsernames,
    exportUserIds,
    cleanupFile,
    cleanupOldFiles
} from '../../services/export.js';

/**
 * Получить язык пользователя
 */
async function getUserLanguage(userId) {
    const user = await database.getUser(userId);
    return user?.language || 'en';
}

/**
 * Обработчик кнопки "Экспорт данных"
 */
export async function handleExport(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`💾 User ${userId} opened export menu`);

    // Очищаем старые файлы при открытии меню
    cleanupOldFiles();

    await ctx.editMessageText(
        t('admin.export.title', lang),
        getExportKeyboard(lang)
    );
}

/**
 * Экспорт в Excel
 */
export async function handleExportExcel(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery(t('admin.export.generating', lang));

    console.log(`📊 User ${userId} requested Excel export`);

    try {
        // Показываем статус
        const statusMessage = await ctx.reply(
            '⏳ Generating Excel file...\n\nPlease wait...'
        );

        // Генерируем файл
        const result = await exportToExcel();

        if (!result.success) {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMessage.message_id,
                null,
                `❌ ${t('admin.export.error', lang)}\n\nError: ${result.error}`
            );
            return;
        }

        // Отправляем файл
        await ctx.replyWithDocument(
            { source: result.filepath, filename: result.filename },
            {
                caption: `✅ ${t('admin.export.success', lang)}\n\n` +
                    `📊 Total users: ${result.count}\n` +
                    `📅 Generated: ${new Date().toLocaleString()}`
            }
        );

        // Удаляем статус-сообщение
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id);

        // Удаляем временный файл
        setTimeout(() => {
            cleanupFile(result.filepath);
        }, 5000);

        console.log(`✅ Excel file sent to ${userId}`);

    } catch (error) {
        console.error('❌ Error in Excel export:', error);
        await ctx.reply(t('admin.export.error', lang));
    }
}

/**
 * Экспорт в CSV
 */
export async function handleExportCSV(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery(t('admin.export.generating', lang));

    console.log(`📄 User ${userId} requested CSV export`);

    try {
        // Показываем статус
        const statusMessage = await ctx.reply(
            '⏳ Generating CSV file...\n\nPlease wait...'
        );

        // Генерируем файл
        const result = await exportToCSV();

        if (!result.success) {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMessage.message_id,
                null,
                `❌ ${t('admin.export.error', lang)}\n\nError: ${result.error}`
            );
            return;
        }

        // Отправляем файл
        await ctx.replyWithDocument(
            { source: result.filepath, filename: result.filename },
            {
                caption: `✅ ${t('admin.export.success', lang)}\n\n` +
                    `📊 Total users: ${result.count}\n` +
                    `📅 Generated: ${new Date().toLocaleString()}`
            }
        );

        // Удаляем статус-сообщение
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id);

        // Удаляем временный файл
        setTimeout(() => {
            cleanupFile(result.filepath);
        }, 5000);

        console.log(`✅ CSV file sent to ${userId}`);

    } catch (error) {
        console.error('❌ Error in CSV export:', error);
        await ctx.reply(t('admin.export.error', lang));
    }
}

/**
 * Экспорт usernames
 */
export async function handleExportUsernames(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery(t('admin.export.generating', lang));

    console.log(`👤 User ${userId} requested usernames export`);

    try {
        // Показываем статус
        const statusMessage = await ctx.reply(
            '⏳ Generating usernames list...\n\nPlease wait...'
        );

        // Генерируем файл
        const result = await exportUsernames();

        if (!result.success) {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMessage.message_id,
                null,
                `❌ ${t('admin.export.error', lang)}\n\nError: ${result.error}`
            );
            return;
        }

        // Отправляем файл
        await ctx.replyWithDocument(
            { source: result.filepath, filename: result.filename },
            {
                caption: `✅ ${t('admin.export.success', lang)}\n\n` +
                    `👤 Usernames: ${result.count}\n` +
                    `👥 Total users: ${result.total}\n` +
                    `📅 Generated: ${new Date().toLocaleString()}`
            }
        );

        // Удаляем статус-сообщение
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id);

        // Удаляем временный файл
        setTimeout(() => {
            cleanupFile(result.filepath);
        }, 5000);

        console.log(`✅ Usernames file sent to ${userId}`);

    } catch (error) {
        console.error('❌ Error in usernames export:', error);
        await ctx.reply(t('admin.export.error', lang));
    }
}

/**
 * Экспорт user IDs
 */
export async function handleExportUserIds(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery(t('admin.export.generating', lang));

    console.log(`🆔 User ${userId} requested user IDs export`);

    try {
        // Показываем статус
        const statusMessage = await ctx.reply(
            '⏳ Generating user IDs list...\n\nPlease wait...'
        );

        // Генерируем файл
        const result = await exportUserIds();

        if (!result.success) {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMessage.message_id,
                null,
                `❌ ${t('admin.export.error', lang)}\n\nError: ${result.error}`
            );
            return;
        }

        // Отправляем файл
        await ctx.replyWithDocument(
            { source: result.filepath, filename: result.filename },
            {
                caption: `✅ ${t('admin.export.success', lang)}\n\n` +
                    `🆔 Total IDs: ${result.count}\n` +
                    `📅 Generated: ${new Date().toLocaleString()}`
            }
        );

        // Удаляем статус-сообщение
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id);

        // Удаляем временный файл
        setTimeout(() => {
            cleanupFile(result.filepath);
        }, 5000);

        console.log(`✅ User IDs file sent to ${userId}`);

    } catch (error) {
        console.error('❌ Error in user IDs export:', error);
        await ctx.reply(t('admin.export.error', lang));
    }
}

/**
 * Регистрация обработчиков экспорта
 */
export function registerExportHandlers(bot) {
    bot.action('admin_export', adminMiddleware, handleExport);
    bot.action('export_excel', adminMiddleware, handleExportExcel);
    bot.action('export_csv', adminMiddleware, handleExportCSV);
    bot.action('export_usernames', adminMiddleware, handleExportUsernames);
    bot.action('export_ids', adminMiddleware, handleExportUserIds);

    console.log('✅ Export handlers registered');
}