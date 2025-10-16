import { database } from '../../config/services/database.js';
import { t } from '../../locales/i18n.js';
import { getAdminKeyboard } from '../../utils/keyboards.js';

/**
 * Получить язык пользователя
 */
async function getUserLanguage(userId) {
    const user = await database.getUser(userId);
    return user?.language || 'en';
}

/**
 * Проверить права администратора
 */
async function checkAdminAccess(ctx) {
    const userId = ctx.from.id;
    const isAdmin = await database.isAdmin(userId);

    if (!isAdmin) {
        const lang = await getUserLanguage(userId);
        await ctx.reply(t('admin.access_denied', lang));

        // Логируем несанкционированную попытку доступа
        console.log(`⚠️ Unauthorized admin access attempt:`);
        console.log(`   User ID: ${userId}`);
        console.log(`   Username: @${ctx.from.username || 'unknown'}`);
        console.log(`   Name: ${ctx.from.first_name} ${ctx.from.last_name || ''}`);

        return false;
    }

    return true;
}

/**
 * Обработчик команды /admin
 */
export async function handleAdminCommand(ctx) {
    const userId = ctx.from.id;
    const username = ctx.from.username;

    console.log(`\n🔐 Admin access attempt:`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Username: @${username || 'unknown'}`);

    // Проверяем права доступа
    const hasAccess = await checkAdminAccess(ctx);
    if (!hasAccess) {
        return;
    }

    // Получаем язык пользователя
    const lang = await getUserLanguage(userId);

    // Логируем успешный вход
    console.log(`✅ Admin panel accessed by ${userId} (@${username})`);

    // Отправляем главное меню админки
    await ctx.reply(
        t('admin.panel_title', lang),
        getAdminKeyboard(lang)
    );
}

/**
 * Обработчик кнопки "Назад" в админке
 */
export async function handleAdminBack(ctx) {
    const userId = ctx.from.id;

    // Проверяем права доступа
    const hasAccess = await checkAdminAccess(ctx);
    if (!hasAccess) {
        await ctx.answerCbQuery(t('admin.access_denied', 'en'));
        return;
    }

    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    // Возвращаемся в главное меню админки
    await ctx.editMessageText(
        t('admin.panel_title', lang),
        getAdminKeyboard(lang)
    );
}

/**
 * Middleware для проверки прав администратора
 */
export async function adminMiddleware(ctx, next) {
    const userId = ctx.from.id;
    const isAdmin = await database.isAdmin(userId);

    if (!isAdmin) {
        const lang = await getUserLanguage(userId);
        await ctx.answerCbQuery(t('admin.access_denied', lang));

        console.log(`⚠️ Unauthorized action attempt by ${userId}`);
        return;
    }

    // Пользователь - админ, продолжаем
    await next();
}

/**
 * Регистрация всех обработчиков админки
 */
export function registerAdminHandlers(bot) {
    // Команда /admin
    bot.command('admin', handleAdminCommand);

    // Кнопка "Назад"
    bot.action('admin_back', handleAdminBack);

    console.log('✅ Admin handlers registered');
}