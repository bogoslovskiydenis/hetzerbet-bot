import { database } from '../../config/services/database.js';
import { t } from '../../locales/i18n.js';
import { getBackButton } from '../../utils/keyboards.js';
import { adminMiddleware } from './index.js';

/**
 * Получить язык пользователя
 */
async function getUserLanguage(userId) {
    const user = await database.getUser(userId);
    return user?.language || 'en';
}

/**
 * Форматировать сообщение со статистикой
 */
function formatStatisticsMessage(stats, lang) {
    return `
${t('admin.statistics.title', lang)}

${t('admin.statistics.total_users', lang, { count: stats.total_users })}
${t('admin.statistics.new_week', lang, { count: stats.new_this_week })}
${t('admin.statistics.new_month', lang, { count: stats.new_this_month })}
${t('admin.statistics.last_month', lang, { count: stats.new_last_month })}

${t('admin.statistics.by_language', lang)}
${t('admin.statistics.german', lang, { count: stats.by_language.de || 0 })}
${t('admin.statistics.english', lang, { count: stats.by_language.en || 0 })}
${t('admin.statistics.not_set', lang, { count: stats.by_language.null || 0 })}
    `.trim();
}

/**
 * Обработчик кнопки "Статистика"
 */
export async function handleStatistics(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    // Показываем индикатор загрузки
    await ctx.answerCbQuery('📊 Loading statistics...');

    console.log(`📈 User ${userId} requested statistics`);

    try {
        // Получаем полную статистику из БД
        const stats = await database.getFullStats();

        if (!stats) {
            await ctx.reply(t('errors.general', lang));
            return;
        }

        // Форматируем и отправляем сообщение
        const message = formatStatisticsMessage(stats, lang);

        await ctx.editMessageText(
            message,
            getBackButton(lang)
        );

        console.log(`✅ Statistics sent to ${userId}`);

    } catch (error) {
        console.error('❌ Error loading statistics:', error);
        await ctx.reply(t('errors.general', lang));
    }
}

/**
 * Регистрация обработчиков статистики
 */
export function registerStatisticsHandlers(bot) {
    bot.action('admin_stats', adminMiddleware, handleStatistics);

    console.log('✅ Statistics handlers registered');
}