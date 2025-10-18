import { Markup } from 'telegraf';
import { database } from '../../config/services/database.js';
import { t } from '../../locales/i18n.js';
import { adminMiddleware } from './index.js';
import { broadcastStates } from '../../utils/broadcastStates.js';

/**
 * Получить язык пользователя
 */
async function getUserLanguage(userId) {
    const user = await database.getUser(userId);
    return user?.language || 'en';
}

/**
 * Главное меню рассылок
 */
export async function handleBroadcast(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`📢 User ${userId} opened broadcast menu`);

    // Сбрасываем состояние
    broadcastStates.delete(userId);

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(
            t('admin.broadcast.all_users', lang),
            'broadcast_audience_all'
        )],
        [Markup.button.callback(
            t('admin.broadcast.german_only', lang),
            'broadcast_audience_de'
        )],
        [Markup.button.callback(
            t('admin.broadcast.english_only', lang),
            'broadcast_audience_en'
        )],
        [Markup.button.callback(
            t('admin.button_back', lang),
            'admin_back'
        )]
    ]);

    await ctx.editMessageText(
        t('admin.broadcast.choose_audience', lang),
        keyboard
    );
}

/**
 * Выбор аудитории
 */
export async function handleBroadcastAudience(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const audience = ctx.match[1]; // all, de, en

    await ctx.answerCbQuery();

    console.log(`👥 User ${userId} selected audience: ${audience}`);

    // Инициализируем состояние
    broadcastStates.init(userId, audience);
    broadcastStates.update(userId, { step: 'text' });

    await ctx.editMessageText(
        t('admin.broadcast.send_text', lang) + '\n\n' +
        t('admin.broadcast.button_cancel_hint', lang),
        Markup.inlineKeyboard([
            [Markup.button.callback(
                t('admin.broadcast.button_cancel', lang),
                'broadcast_cancel'
            )]
        ])
    );
}

/**
 * Получение текста рассылки
 */
async function handleBroadcastText(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const state = broadcastStates.get(userId);

    if (!state || !broadcastStates.isAwaitingText(userId)) {
        return; // Игнорируем, если не в процессе создания рассылки
    }

    const text = ctx.message.text;

    if (text === '/cancel') {
        broadcastStates.delete(userId);
        await ctx.reply(
            t('admin.broadcast.cancelled', lang),
            Markup.inlineKeyboard([
                [Markup.button.callback(
                    t('admin.button_back', lang),
                    'admin_back'
                )]
            ])
        );
        return;
    }

    // Сохраняем текст
    broadcastStates.update(userId, { text, step: 'media' });

    console.log(`📝 User ${userId} set broadcast text`);

    // Запрашиваем медиа
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(
            t('admin.broadcast.button_skip', lang),
            'broadcast_skip_media'
        )],
        [Markup.button.callback(
            t('admin.broadcast.button_cancel', lang),
            'broadcast_cancel'
        )]
    ]);

    await ctx.reply(
        t('admin.broadcast.send_media', lang),
        keyboard
    );
}

/**
 * Получение медиа
 */
export async function handleBroadcastMedia(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const state = broadcastStates.get(userId);

    if (!state || !broadcastStates.isAwaitingMedia(userId)) {
        return;
    }

    let mediaId = null;
    let mediaType = null;

    // Определяем тип медиа
    if (ctx.message.photo) {
        mediaId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        mediaType = 'photo';
    } else if (ctx.message.video) {
        mediaId = ctx.message.video.file_id;
        mediaType = 'video';
    } else if (ctx.message.animation) {
        mediaId = ctx.message.animation.file_id;
        mediaType = 'animation';
    } else if (ctx.message.document) {
        mediaId = ctx.message.document.file_id;
        mediaType = 'document';
    }

    if (!mediaId) {
        await ctx.reply('❌ ' + t('admin.broadcast.invalid_media', lang));
        return;
    }

    // Сохраняем медиа
    broadcastStates.update(userId, {
        media: mediaId,
        mediaType: mediaType,
        step: 'buttons'
    });

    console.log(`🖼️ User ${userId} added media (${mediaType})`);

    // Запрашиваем кнопки
    await requestButtons(ctx, userId, lang);
}

/**
 * Пропуск медиа
 */
export async function handleSkipMedia(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`⏭️ User ${userId} skipped media`);

    await ctx.deleteMessage();
    await requestButtons(ctx, userId, lang);
}

/**
 * Запрос кнопок
 */
async function requestButtons(ctx, userId, lang) {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(
            t('admin.broadcast.button_skip', lang),
            'broadcast_skip_buttons'
        )],
        [Markup.button.callback(
            t('admin.broadcast.button_cancel', lang),
            'broadcast_cancel'
        )]
    ]);

    await ctx.reply(
        t('admin.broadcast.add_buttons', lang),
        keyboard
    );
}

/**
 * Получение кнопок
 */
async function handleBroadcastButtons(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const state = broadcastStates.get(userId);

    if (!state || !broadcastStates.isAwaitingButtons(userId)) {
        return;
    }

    const text = ctx.message.text;

    // Парсим кнопки (формат: "Текст кнопки | URL")
    const lines = text.split('\n').filter(line => line.trim());
    const buttons = [];

    for (const line of lines) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
            buttons.push({
                text: parts[0],
                url: parts[1]
            });
        }
    }

    if (buttons.length === 0) {
        await ctx.reply('❌ ' + t('admin.broadcast.invalid_buttons', lang));
        return;
    }

    if (buttons.length > 8) {
        await ctx.reply('❌ ' + t('admin.broadcast.too_many_buttons', lang));
        return;
    }

    // Сохраняем кнопки
    broadcastStates.update(userId, { buttons, step: 'preview' });

    console.log(`🔘 User ${userId} added ${buttons.length} buttons`);

    // Показываем предпросмотр
    await showBroadcastPreview(ctx, userId, lang);
}

/**
 * Пропуск кнопок
 */
export async function handleSkipButtons(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`⏭️ User ${userId} skipped buttons`);

    await ctx.deleteMessage();
    await showBroadcastPreview(ctx, userId, lang);
}

/**
 * Показать предпросмотр
 */
async function showBroadcastPreview(ctx, userId, lang) {
    const state = broadcastStates.get(userId);

    // Получаем количество целевой аудитории
    let targetUsers = [];
    if (state.audience === 'all') {
        targetUsers = await database.getUsersWithNotifications();
    } else {
        targetUsers = await database.getUsersWithNotifications(state.audience);
    }

    const count = targetUsers.length;

    // Формируем сообщение предпросмотра
    let previewText = t('admin.broadcast.preview', lang, { text: state.text });
    previewText += `\n\n📊 ${t('admin.broadcast.target_count', lang, { count })}`;

    if (state.buttons.length > 0) {
        previewText += `\n🔘 ${t('admin.broadcast.buttons_count', lang, { count: state.buttons.length })}`;
    }

    // Кнопки для подтверждения
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(
            t('admin.broadcast.button_send', lang),
            'broadcast_confirm'
        )],
        [Markup.button.callback(
            t('admin.broadcast.button_cancel', lang),
            'broadcast_cancel'
        )]
    ]);

    // Отправляем предпросмотр с медиа
    if (state.media) {
        if (state.mediaType === 'photo') {
            await ctx.replyWithPhoto(state.media, {
                caption: previewText,
                ...keyboard
            });
        } else if (state.mediaType === 'video') {
            await ctx.replyWithVideo(state.media, {
                caption: previewText,
                ...keyboard
            });
        } else if (state.mediaType === 'animation') {
            await ctx.replyWithAnimation(state.media, {
                caption: previewText,
                ...keyboard
            });
        }
    } else {
        await ctx.reply(previewText, keyboard);
    }
}

/**
 * Подтверждение и отправка рассылки
 */
export async function handleBroadcastConfirm(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const state = broadcastStates.get(userId);

    if (!state) {
        await ctx.answerCbQuery('❌ Session expired');
        return;
    }

    await ctx.answerCbQuery('📤 Sending broadcast...');
    await ctx.editMessageCaption(
        '📤 ' + t('admin.broadcast.sending', lang, { sent: 0, total: '...' })
    );

    console.log(`📤 User ${userId} confirmed broadcast to ${state.audience}`);

    // Создаем запись в БД
    const broadcastId = await database.createBroadcast({
        text: state.text,
        media_url: state.media,
        media_type: state.mediaType,
        buttons: state.buttons,
        target_language: state.audience,
        admin_id: userId
    });

    // Получаем целевую аудиторию
    let targetUsers = [];
    if (state.audience === 'all') {
        targetUsers = await database.getUsersWithNotifications();
    } else {
        targetUsers = await database.getUsersWithNotifications(state.audience);
    }

    // Обновляем статус рассылки
    await database.updateBroadcast(broadcastId, {
        status: 'in_progress',
        total_count: targetUsers.length,
        started_at: new Date()
    });

    // Формируем кнопки
    let buttonsKeyboard = null;
    if (state.buttons.length > 0) {
        const buttonRows = [];
        for (const btn of state.buttons) {
            buttonRows.push([Markup.button.url(btn.text, btn.url)]);
        }
        buttonsKeyboard = Markup.inlineKeyboard(buttonRows);
    }

    // Отправляем рассылку
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targetUsers.length; i++) {
        const user = targetUsers[i];
        const userLang = user.language || 'en';

        try {
            // Отправляем сообщение
            if (state.media) {
                if (state.mediaType === 'photo') {
                    await ctx.telegram.sendPhoto(user.user_id, state.media, {
                        caption: state.text,
                        ...buttonsKeyboard
                    });
                } else if (state.mediaType === 'video') {
                    await ctx.telegram.sendVideo(user.user_id, state.media, {
                        caption: state.text,
                        ...buttonsKeyboard
                    });
                } else if (state.mediaType === 'animation') {
                    await ctx.telegram.sendAnimation(user.user_id, state.media, {
                        caption: state.text,
                        ...buttonsKeyboard
                    });
                }
            } else {
                await ctx.telegram.sendMessage(user.user_id, state.text, buttonsKeyboard);
            }

            sentCount++;

            // Задержка для избежания блокировок (30 сообщений в секунду)
            if (i % 30 === 0 && i > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Обновляем прогресс каждые 10 пользователей
            if (i % 10 === 0 || i === targetUsers.length - 1) {
                try {
                    await ctx.editMessageCaption(
                        '📤 ' + t('admin.broadcast.sending', lang, {
                            sent: sentCount,
                            total: targetUsers.length
                        })
                    );
                } catch (e) {
                    // Игнорируем ошибки редактирования
                }
            }

        } catch (error) {
            console.error(`❌ Failed to send to ${user.user_id}:`, error.message);
            failedCount++;
        }
    }

    // Обновляем статус в БД
    await database.updateBroadcast(broadcastId, {
        status: 'completed',
        sent_count: sentCount,
        failed_count: failedCount,
        completed_at: new Date()
    });

    // Отправляем отчет
    const reportText = t('admin.broadcast.completed', lang, {
        sent: sentCount,
        failed: failedCount,
        total: targetUsers.length
    });

    await ctx.editMessageCaption(reportText);

    console.log(`✅ Broadcast completed: ${sentCount}/${targetUsers.length}`);

    // Очищаем состояние
    broadcastStates.delete(userId);
}

/**
 * Отмена рассылки
 */
export async function handleBroadcastCancel(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    broadcastStates.delete(userId);

    await ctx.editMessageText(
        t('admin.broadcast.cancelled', lang),
        Markup.inlineKeyboard([
            [Markup.button.callback(
                t('admin.button_back', lang),
                'admin_back'
            )]
        ])
    );

    console.log(`❌ User ${userId} cancelled broadcast`);
}

/**
 * Регистрация обработчиков рассылок
 */
export function registerBroadcastHandlers(bot) {
    // Главное меню
    bot.action('admin_broadcast', adminMiddleware, handleBroadcast);

    // Выбор аудитории
    bot.action(/broadcast_audience_(all|de|en)/, adminMiddleware, handleBroadcastAudience);

    // Пропуск медиа и кнопок
    bot.action('broadcast_skip_media', adminMiddleware, handleSkipMedia);
    bot.action('broadcast_skip_buttons', adminMiddleware, handleSkipButtons);

    // Подтверждение и отмена
    bot.action('broadcast_confirm', adminMiddleware, handleBroadcastConfirm);
    bot.action('broadcast_cancel', adminMiddleware, handleBroadcastCancel);

    // Обработка медиа
    bot.on(['photo', 'video', 'animation', 'document'], async (ctx, next) => {
        const userId = ctx.from.id;

        if (broadcastStates.isAwaitingMedia(userId)) {
            const isAdmin = await database.isAdmin(userId);
            if (isAdmin) {
                await handleBroadcastMedia(ctx);
                return;
            }
        }

        await next();
    });

    console.log('✅ Broadcast handlers registered');
}

// Экспорт функций для текстовых сообщений
export { handleBroadcastText, handleBroadcastButtons };