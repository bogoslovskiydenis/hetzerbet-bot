import { Markup } from 'telegraf';
import { database } from '../../config/services/database.js';
import { t } from '../../locales/i18n.js';
import { adminMiddleware } from './index.js';
import { broadcastStates } from '../../utils/broadcastStates.js';
import admin from '../../config/firebase.js';

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
            t('admin.broadcast.create_new', lang),
            'broadcast_create_new'
        )],
        [Markup.button.callback(
            t('admin.broadcast.view_scheduled', lang),
            'broadcast_view_scheduled'
        )],
        [Markup.button.callback(
            t('admin.button_back', lang),
            'admin_back'
        )]
    ]);

    await ctx.editMessageText(
        t('admin.broadcast.menu_title', lang),
        keyboard
    );
}

/**
 * Создать новую рассылку
 */
export async function handleBroadcastCreateNew(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

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
            'admin_broadcast'
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
export async function handleBroadcastText(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const state = broadcastStates.get(userId);

    if (!state || !broadcastStates.isAwaitingText(userId)) {
        return;
    }

    const text = ctx.message.text;

    if (text === '/cancel') {
        broadcastStates.delete(userId);
        await ctx.reply(
            t('admin.broadcast.cancelled', lang),
            Markup.inlineKeyboard([
                [Markup.button.callback(
                    t('admin.button_back', lang),
                    'admin_broadcast'
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

    broadcastStates.update(userId, { step: 'buttons' });

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
export async function handleBroadcastButtons(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const state = broadcastStates.get(userId);

    if (!state || !broadcastStates.isAwaitingButtons(userId)) {
        return;
    }

    const text = ctx.message.text;

    // Парсим кнопки
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
    broadcastStates.update(userId, { buttons, step: 'scheduling' });

    console.log(`📘 User ${userId} added ${buttons.length} buttons`);

    // Переходим к выбору времени отправки
    await showSchedulingOptions(ctx, userId, lang);
}

/**
 * Пропуск кнопок
 */
export async function handleSkipButtons(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`⏭️ User ${userId} skipped buttons`);

    broadcastStates.update(userId, { step: 'scheduling' });

    await ctx.deleteMessage();
    await showSchedulingOptions(ctx, userId, lang);
}

/**
 * Показать опции планирования
 */
async function showSchedulingOptions(ctx, userId, lang) {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(
            t('admin.broadcast.send_now', lang),
            'broadcast_send_now'
        )],
        [Markup.button.callback(
            t('admin.broadcast.schedule', lang),
            'broadcast_schedule'
        )],
        [Markup.button.callback(
            t('admin.broadcast.button_cancel', lang),
            'broadcast_cancel'
        )]
    ]);

    await ctx.reply(
        t('admin.broadcast.choose_send_time', lang),
        keyboard
    );
}

/**
 * Отправить сейчас - показываем preview
 */
export async function handleSendNow(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`⚡ User ${userId} chose to send now`);

    broadcastStates.update(userId, { scheduled: false });

    await ctx.deleteMessage();
    await showBroadcastPreview(ctx, userId, lang);
}

/**
 * Запланировать - запрашиваем дату и время
 */
export async function handleSchedule(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`📅 User ${userId} chose to schedule`);

    broadcastStates.update(userId, { scheduled: true, step: 'awaiting_datetime' });

    await ctx.deleteMessage();

    await ctx.reply(
        t('admin.broadcast.enter_datetime', lang) +
        '\n\n' + t('admin.broadcast.datetime_format', lang) +
        '\n\n' + t('admin.broadcast.datetime_example', lang),
        Markup.inlineKeyboard([
            [Markup.button.callback(
                t('admin.broadcast.button_cancel', lang),
                'broadcast_cancel'
            )]
        ])
    );
}

/**
 * Обработка введенной даты/времени
 */
export async function handleDateTimeInput(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const state = broadcastStates.get(userId);

    if (!state || state.step !== 'awaiting_datetime') {
        return;
    }

    const text = ctx.message.text.trim();

    // Парсим дату и время
    const dateTimeRegex = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/;
    const match = text.match(dateTimeRegex);

    if (!match) {
        await ctx.reply(
            '❌ ' + t('admin.broadcast.invalid_datetime_format', lang) +
            '\n\n' + t('admin.broadcast.datetime_example', lang)
        );
        return;
    }

    const [, day, month, year, hour, minute] = match;

    // Создаем дату в UTC+3 (Moscow)
    try {
        // Создаем дату в UTC+3
        const scheduledDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+03:00`);

        // Проверяем валидность даты
        if (isNaN(scheduledDate.getTime())) {
            await ctx.reply('❌ ' + t('admin.broadcast.invalid_date', lang));
            return;
        }

        // Проверяем что дата в будущем
        const now = new Date();
        if (scheduledDate <= now) {
            await ctx.reply('❌ ' + t('admin.broadcast.date_in_past', lang));
            return;
        }

        // Сохраняем дату
        broadcastStates.update(userId, {
            scheduledTime: scheduledDate,
            step: 'preview'
        });

        console.log(`📅 User ${userId} scheduled for: ${scheduledDate.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`);

        // Показываем preview
        await showBroadcastPreview(ctx, userId, lang);

    } catch (error) {
        console.error('Error parsing date:', error);
        await ctx.reply('❌ ' + t('admin.broadcast.invalid_date', lang));
    }
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
        previewText += `\n📘 ${t('admin.broadcast.buttons_count', lang, { count: state.buttons.length })}`;
    }

    if (state.scheduled && state.scheduledTime) {
        const formattedDate = state.scheduledTime.toLocaleString('ru-RU', {
            timeZone: 'Europe/Moscow',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        previewText += `\n\n🕐 ${t('admin.broadcast.scheduled_for', lang)}: ${formattedDate}`;
    } else {
        previewText += `\n\n⚡ ${t('admin.broadcast.send_immediately', lang)}`;
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

    await ctx.answerCbQuery();

    // Если это запланированная рассылка - сохраняем в БД
    if (state.scheduled && state.scheduledTime) {
        await handleScheduledBroadcast(ctx, userId, lang, state);
    } else {
        // Отправляем немедленно
        await handleImmediateBroadcast(ctx, userId, lang, state);
    }
}

/**
 * Обработка запланированной рассылки
 */
async function handleScheduledBroadcast(ctx, userId, lang, state) {
    try {
        await ctx.editMessageCaption(
            '💾 ' + t('admin.broadcast.saving_scheduled', lang)
        );

        console.log(`📅 User ${userId} creating scheduled broadcast`);

        // Создаем запись в БД
        const broadcastId = await database.createScheduledBroadcast({
            text: state.text,
            media_url: state.media,
            media_type: state.mediaType,
            buttons: state.buttons,
            target_language: state.audience,
            scheduled_time: admin.firestore.Timestamp.fromDate(state.scheduledTime),
            admin_id: userId
        });

        if (!broadcastId) {
            throw new Error('Failed to create scheduled broadcast');
        }

        const formattedDate = state.scheduledTime.toLocaleString('ru-RU', {
            timeZone: 'Europe/Moscow',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        await ctx.editMessageCaption(
            '✅ ' + t('admin.broadcast.scheduled_success', lang) +
            '\n\n🕐 ' + t('admin.broadcast.scheduled_for', lang) + ': ' + formattedDate +
            '\n📋 ID: ' + broadcastId
        );

        console.log(`✅ Scheduled broadcast ${broadcastId} created`);

        // Очищаем состояние
        broadcastStates.delete(userId);

    } catch (error) {
        console.error('❌ Error creating scheduled broadcast:', error);
        await ctx.reply('❌ ' + t('errors.general', lang));
        broadcastStates.delete(userId);
    }
}

/**
 * Обработка немедленной рассылки
 */
async function handleImmediateBroadcast(ctx, userId, lang, state) {
    try {
        await ctx.editMessageCaption(
            '📤 ' + t('admin.broadcast.sending', lang, { sent: 0, total: '...' })
        );

        console.log(`📤 User ${userId} confirmed immediate broadcast to ${state.audience}`);

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

    } catch (error) {
        console.error('❌ Error in immediate broadcast:', error);
        await ctx.reply('❌ ' + t('errors.general', lang));
        broadcastStates.delete(userId);
    }
}

/**
 * Просмотр запланированных рассылок
 */
export async function handleViewScheduled(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`📋 User ${userId} viewing scheduled broadcasts`);

    try {
        // Получаем все запланированные рассылки
        const scheduledBroadcasts = await database.getAllScheduledBroadcasts();

        if (!scheduledBroadcasts || scheduledBroadcasts.length === 0) {
            await ctx.editMessageText(
                t('admin.broadcast.no_scheduled', lang),
                Markup.inlineKeyboard([
                    [Markup.button.callback(
                        t('admin.button_back', lang),
                        'admin_broadcast'
                    )]
                ])
            );
            return;
        }

        // Формируем список
        let message = t('admin.broadcast.scheduled_list', lang) + '\n\n';

        scheduledBroadcasts.forEach((broadcast, index) => {
            const scheduledTime = broadcast.scheduled_time.toDate();
            const formattedDate = scheduledTime.toLocaleString('ru-RU', {
                timeZone: 'Europe/Moscow',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const audienceText = broadcast.target_language === 'all'
                ? t('admin.broadcast.all_users', lang)
                : broadcast.target_language === 'de'
                    ? t('admin.broadcast.german_only', lang)
                    : t('admin.broadcast.english_only', lang);

            message += `${index + 1}. 🕐 ${formattedDate}\n`;
            message += `   👥 ${audienceText}\n`;
            message += `   📋 ID: ${broadcast.id}\n`;
            message += `   📝 ${broadcast.text.substring(0, 50)}${broadcast.text.length > 50 ? '...' : ''}\n\n`;
        });

        // Создаем кнопки для удаления
        const buttons = scheduledBroadcasts.map((broadcast, index) => {
            return [Markup.button.callback(
                `❌ ${index + 1}`,
                `broadcast_delete_${broadcast.id}`
            )];
        });

        buttons.push([Markup.button.callback(
            t('admin.button_back', lang),
            'admin_broadcast'
        )]);

        await ctx.editMessageText(
            message,
            Markup.inlineKeyboard(buttons)
        );

    } catch (error) {
        console.error('❌ Error viewing scheduled broadcasts:', error);
        await ctx.reply('❌ ' + t('errors.general', lang));
    }
}

/**
 * Удаление запланированной рассылки
 */
export async function handleDeleteScheduled(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const broadcastId = ctx.match[1];

    await ctx.answerCbQuery(t('admin.broadcast.deleting', lang));

    console.log(`🗑️ User ${userId} deleting scheduled broadcast ${broadcastId}`);

    try {
        const success = await database.cancelScheduledBroadcast(broadcastId);

        if (success) {
            await ctx.answerCbQuery(
                '✅ ' + t('admin.broadcast.deleted', lang),
                { show_alert: true }
            );

            // Обновляем список
            await handleViewScheduled(ctx);
        } else {
            await ctx.answerCbQuery(
                '❌ ' + t('errors.general', lang),
                { show_alert: true }
            );
        }

    } catch (error) {
        console.error('❌ Error deleting scheduled broadcast:', error);
        await ctx.answerCbQuery(
            '❌ ' + t('errors.general', lang),
            { show_alert: true }
        );
    }
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
                'admin_broadcast'
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

    // Создание новой рассылки
    bot.action('broadcast_create_new', adminMiddleware, handleBroadcastCreateNew);

    // Выбор аудитории
    bot.action(/broadcast_audience_(all|de|en)/, adminMiddleware, handleBroadcastAudience);

    // Пропуск медиа и кнопок
    bot.action('broadcast_skip_media', adminMiddleware, handleSkipMedia);
    bot.action('broadcast_skip_buttons', adminMiddleware, handleSkipButtons);

    // Выбор времени отправки
    bot.action('broadcast_send_now', adminMiddleware, handleSendNow);
    bot.action('broadcast_schedule', adminMiddleware, handleSchedule);

    // Подтверждение и отмена
    bot.action('broadcast_confirm', adminMiddleware, handleBroadcastConfirm);
    bot.action('broadcast_cancel', adminMiddleware, handleBroadcastCancel);

    // Просмотр и удаление запланированных
    bot.action('broadcast_view_scheduled', adminMiddleware, handleViewScheduled);
    bot.action(/broadcast_delete_(.+)/, adminMiddleware, handleDeleteScheduled);

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
