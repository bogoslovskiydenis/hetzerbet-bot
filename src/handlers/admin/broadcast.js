import { adminMiddleware } from './index.js';

/**
 * Обработчик кнопки "Рассылки"
 * TODO: Реализовать полный функционал рассылок
 */
export async function handleBroadcast(ctx) {
    const userId = ctx.from.id;

    await ctx.answerCbQuery();

    console.log(`📢 User ${userId} opened broadcast menu`);

    await ctx.reply(
        'Функционал рассылок .\n\n' +
        'Планируемые возможности:\n' +
        '• Выбор аудитории (все/DE/EN)\n' +
        '• Отправка текста и медиа\n' +
        '• Добавление кнопок (до 8)\n' +
        '• Предпросмотр перед отправкой\n' +
        '• Отчет о результатах'
    );
}

/**
 * Регистрация обработчиков рассылок
 */
export function registerBroadcastHandlers(bot) {
    bot.action('admin_broadcast', adminMiddleware, handleBroadcast);

    console.log('✅ Broadcast handlers registered (stub)');
}