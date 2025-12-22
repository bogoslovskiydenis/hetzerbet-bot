import { Markup } from 'telegraf';
import { database } from '../../config/services/database.js';
import { t } from '../../locales/i18n.js';
import { adminMiddleware } from './index.js';

/**
 * Получить язык пользователя
 */
async function getUserLanguage(userId) {
    const user = await database.getUser(userId);
    return user?.language || 'en';
}

/**
 * Главное меню управления отложенными сообщениями
 */
export async function handleDelayedMessages(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    console.log(`⏱️ User ${userId} opened delayed messages management`);

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(
            '➕ Создать отложенное сообщение',
            'delayed_message_create'
        )],
        [Markup.button.callback(
            '📋 Список отложенных сообщений',
            'delayed_message_list'
        )],
        [Markup.button.callback(
            '⚙️ Настройки задержки',
            'delayed_message_settings'
        )],
        [Markup.button.callback(
            t('admin.button_back', lang),
            'admin_back'
        )]
    ]);

    const message = '⏱️ УПРАВЛЕНИЕ ОТЛОЖЕННЫМИ СООБЩЕНИЯМИ\n\n' +
        'Здесь вы можете создавать и редактировать отложенные сообщения, которые отправляются пользователям через заданное время после /start.';

    if (ctx.callbackQuery) {
        await ctx.editMessageText(message, keyboard);
    } else {
        await ctx.reply(message, keyboard);
    }
}

/**
 * Создание нового отложенного сообщения
 */
export async function handleCreateDelayedMessage(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    await ctx.reply(
        '➕ СОЗДАНИЕ ОТЛОЖЕННОГО СООБЩЕНИЯ\n\n' +
        'Введите название сообщения:\n\n' +
        'Пример: "1st push welcome 15 min after reg"',
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'delayed_message_cancel')]
        ])
    );

    await database.updateUser(userId, {
        awaiting_input: 'delayed_message_name'
    });
}

/**
 * Список отложенных сообщений
 */
export async function handleDelayedMessageList(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    try {
        const messages = await database.getDelayedMessages();

        if (messages.length === 0) {
            const message = '📋 СПИСОК ОТЛОЖЕННЫХ СООБЩЕНИЙ\n\n' +
                'Отложенные сообщения не найдены.\n\n' +
                'Создайте первое сообщение, нажав "➕ Создать отложенное сообщение"';
            
            if (ctx.callbackQuery) {
                await ctx.editMessageText(message);
            } else {
                await ctx.reply(message);
            }
            return;
        }

        let message = '📋 СПИСОК ОТЛОЖЕННЫХ СООБЩЕНИЙ\n\n';
        
        messages.forEach((msg, index) => {
            message += `${index + 1}. ${msg.name}\n`;
            message += `   📝 ${msg.text_en?.substring(0, 50) || 'Нет текста'}...\n`;
            message += `   🖼️ ${msg.image_url ? 'Есть' : 'Нет'}\n`;
            message += `   🔘 Кнопок: ${msg.buttons?.length || 0}\n\n`;
        });

        const keyboard = [];
        messages.forEach((msg) => {
            keyboard.push([
                Markup.button.callback(
                    `👁️ ${msg.name}`,
                    `delayed_message_view_${msg.id}`
                )
            ]);
        });

        keyboard.push([Markup.button.callback('◀️ Назад', 'delayed_messages_menu')]);

        if (ctx.callbackQuery) {
            await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
        } else {
            await ctx.reply(message, Markup.inlineKeyboard(keyboard));
        }

    } catch (error) {
        console.error('❌ Error loading delayed message list:', error);
        await ctx.reply('❌ Ошибка при загрузке списка отложенных сообщений.');
    }
}

/**
 * Просмотр деталей отложенного сообщения
 */
export async function handleViewDelayedMessageDetails(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    
    try {
        const messageId = ctx.match[1];
        const message = await database.getDelayedMessage(messageId);
        
        if (!message) {
            await ctx.reply('❌ Отложенное сообщение не найдено.');
            return;
        }

        const preview = await formatDelayedMessagePreview(message, lang);
        
        await ctx.reply(
            `📋 **${message.name}**\n\n${preview}`,
            {
                parse_mode: 'Markdown',
                reply_markup: Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✏️ Редактировать', `delayed_message_edit_${messageId}`),
                        Markup.button.callback('🗑️ Удалить', `delayed_message_delete_${messageId}`)
                    ],
                    [Markup.button.callback('◀️ Назад к списку', 'delayed_message_list')]
                ]).reply_markup
            }
        );

    } catch (error) {
        console.error('❌ Error viewing delayed message details:', error);
        await ctx.reply('❌ Ошибка при просмотре отложенного сообщения.');
    }
}

/**
 * Редактирование отложенного сообщения
 */
export async function handleEditDelayedMessage(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const messageId = ctx.match[1];

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    try {
        const message = await database.getDelayedMessage(messageId);

        if (!message) {
            await ctx.reply('❌ Отложенное сообщение не найдено.');
            return;
        }

        const text = `✏️ РЕДАКТИРОВАНИЕ ОТЛОЖЕННОГО СООБЩЕНИЯ\n\n` +
            `📝 Название: ${message.name}\n` +
            `🇬🇧 EN: ${message.text_en || 'Нет'}\n` +
            `🇩🇪 DE: ${message.text_de || 'Нет'}\n` +
            `🖼️ Изображение: ${message.image_url || 'Нет'}\n` +
            `🔘 Кнопок: ${message.buttons?.length || 0}\n\n` +
            `Выберите действие:`;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('📝 Изменить текст', `delayed_message_edit_text_${messageId}`)],
            [Markup.button.callback('🖼️ Изменить изображение', `delayed_message_edit_image_${messageId}`)],
            [Markup.button.callback('🔘 Изменить кнопки', `delayed_message_edit_buttons_${messageId}`)],
            [Markup.button.callback('🗑️ Удалить', `delayed_message_delete_${messageId}`)],
            [Markup.button.callback('◀️ Назад', `delayed_message_view_${messageId}`)]
        ]);

        if (ctx.callbackQuery) {
            await ctx.editMessageText(text, keyboard);
        } else {
            await ctx.reply(text, keyboard);
        }

    } catch (error) {
        console.error('❌ Error editing delayed message:', error);
        await ctx.reply('❌ Ошибка при редактировании отложенного сообщения.');
    }
}

/**
 * Обработчик редактирования текста
 */
export async function handleEditDelayedMessageText(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const messageId = ctx.match[1];

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    try {
        const message = await database.getDelayedMessage(messageId);
        
        if (!message) {
            await ctx.reply('❌ Отложенное сообщение не найдено.');
            return;
        }

        await ctx.reply(
            `📝 РЕДАКТИРОВАНИЕ ТЕКСТА\n\n` +
            `Текущий текст:\n` +
            `🇬🇧 EN: ${message.text_en || 'Нет'}\n\n` +
            `🇩🇪 DE: ${message.text_de || 'Нет'}\n\n` +
            `Выберите язык для редактирования:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🇬🇧 Редактировать английский', `delayed_message_edit_text_en_${messageId}`)],
                [Markup.button.callback('🇩🇪 Редактировать немецкий', `delayed_message_edit_text_de_${messageId}`)],
                [Markup.button.callback('◀️ Назад', `delayed_message_view_${messageId}`)]
            ])
        );

    } catch (error) {
        console.error('❌ Error editing delayed message text:', error);
        await ctx.reply('❌ Ошибка при редактировании текста.');
    }
}

/**
 * Обработчик редактирования английского текста
 */
export async function handleEditDelayedMessageTextEn(ctx) {
    const userId = ctx.from.id;
    const messageId = ctx.match[1];

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    try {
        const message = await database.getDelayedMessage(messageId);
        
        if (!message) {
            await ctx.reply('❌ Отложенное сообщение не найдено.');
            return;
        }

        await ctx.reply(
            `🇬🇧 РЕДАКТИРОВАНИЕ АНГЛИЙСКОГО ТЕКСТА\n\n` +
            `Текущий текст:\n${message.text_en || 'Нет'}\n\n` +
            `Введите новый текст на английском языке:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'delayed_message_cancel_edit')]
            ])
        );

        await database.updateUser(userId, {
            awaiting_input: 'delayed_message_edit_text_en',
            temp_edit_message_id: messageId
        });

    } catch (error) {
        console.error('❌ Error editing EN text:', error);
        await ctx.reply('❌ Ошибка при редактировании текста.');
    }
}

/**
 * Обработчик редактирования немецкого текста
 */
export async function handleEditDelayedMessageTextDe(ctx) {
    const userId = ctx.from.id;
    const messageId = ctx.match[1];

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    try {
        const message = await database.getDelayedMessage(messageId);
        
        if (!message) {
            await ctx.reply('❌ Отложенное сообщение не найдено.');
            return;
        }

        await ctx.reply(
            `🇩🇪 РЕДАКТИРОВАНИЕ НЕМЕЦКОГО ТЕКСТА\n\n` +
            `Текущий текст:\n${message.text_de || 'Нет'}\n\n` +
            `Введите новый текст на немецком языке:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'delayed_message_cancel_edit')]
            ])
        );

        await database.updateUser(userId, {
            awaiting_input: 'delayed_message_edit_text_de',
            temp_edit_message_id: messageId
        });

    } catch (error) {
        console.error('❌ Error editing DE text:', error);
        await ctx.reply('❌ Ошибка при редактировании текста.');
    }
}

/**
 * Обработчик редактирования изображения
 */
export async function handleEditDelayedMessageImage(ctx) {
    const userId = ctx.from.id;
    const messageId = ctx.match[1];

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    try {
        const message = await database.getDelayedMessage(messageId);
        
        if (!message) {
            await ctx.reply('❌ Отложенное сообщение не найдено.');
            return;
        }

        await ctx.reply(
            `🖼️ РЕДАКТИРОВАНИЕ ИЗОБРАЖЕНИЯ\n\n` +
            `Текущее изображение: ${message.image_url || 'Нет'}\n\n` +
            `Введите новый URL изображения или 'skip' для удаления:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'delayed_message_cancel_edit')]
            ])
        );

        await database.updateUser(userId, {
            awaiting_input: 'delayed_message_edit_image',
            temp_edit_message_id: messageId
        });

    } catch (error) {
        console.error('❌ Error editing image:', error);
        await ctx.reply('❌ Ошибка при редактировании изображения.');
    }
}

/**
 * Обработчик редактирования кнопок
 */
export async function handleEditDelayedMessageButtons(ctx) {
    const userId = ctx.from.id;
    const messageId = ctx.match[1];

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    try {
        const message = await database.getDelayedMessage(messageId);
        
        if (!message) {
            await ctx.reply('❌ Отложенное сообщение не найдено.');
            return;
        }

        let buttonsText = 'нет кнопок';
        if (message.buttons && message.buttons.length > 0) {
            buttonsText = message.buttons.map((btn, i) => `${i + 1}. ${btn.text} | ${btn.url}`).join('\n');
        }

        await ctx.reply(
            `🔘 РЕДАКТИРОВАНИЕ КНОПОК\n\n` +
            `Текущие кнопки:\n${buttonsText}\n\n` +
            `Введите кнопки в формате (макс 8):\n` +
            `Текст 1 | URL1\n` +
            `Текст 2 | URL2\n\n` +
            `Или 'skip' для удаления всех кнопок:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'delayed_message_cancel_edit')]
            ])
        );

        await database.updateUser(userId, {
            awaiting_input: 'delayed_message_edit_buttons',
            temp_edit_message_id: messageId
        });

    } catch (error) {
        console.error('❌ Error editing buttons:', error);
        await ctx.reply('❌ Ошибка при редактировании кнопок.');
    }
}

/**
 * Обработчик удаления отложенного сообщения
 */
export async function handleDeleteDelayedMessage(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    
    try {
        const messageId = ctx.match[1];
        const message = await database.getDelayedMessage(messageId);
        
        if (!message) {
            await ctx.reply('❌ Отложенное сообщение не найдено.');
            return;
        }

        await ctx.reply(
            `🗑️ Удалить отложенное сообщение "${message.name}"?\n\nЭто действие нельзя отменить!`,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('✅ Да, удалить', `delayed_message_confirm_delete_${messageId}`),
                    Markup.button.callback('❌ Отмена', 'delayed_message_list')
                ]
            ])
        );

    } catch (error) {
        console.error('❌ Error handling delete delayed message:', error);
        await ctx.reply('❌ Ошибка при удалении отложенного сообщения.');
    }
}

/**
 * Обработчик подтверждения удаления
 */
export async function handleConfirmDeleteDelayedMessage(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    
    try {
        const messageId = ctx.match[1];
        const message = await database.getDelayedMessage(messageId);
        
        if (!message) {
            await ctx.reply('❌ Отложенное сообщение не найдено.');
            return;
        }

        const success = await database.deleteDelayedMessage(messageId);
        
        if (success) {
            await ctx.reply(`✅ Отложенное сообщение "${message.name}" успешно удалено!`);
            await handleDelayedMessageList(ctx);
        } else {
            await ctx.reply('❌ Ошибка при удалении отложенного сообщения.');
        }

    } catch (error) {
        console.error('❌ Error confirming delete delayed message:', error);
        await ctx.reply('❌ Ошибка при удалении отложенного сообщения.');
    }
}

/**
 * Настройки задержки
 */
export async function handleDelayedMessageSettings(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    try {
        const settings = await database.getBotSettings();
        const delayMinutes = settings?.delayed_message_delay_minutes || 15;

        const message = 
            `⚙️ НАСТРОЙКИ ЗАДЕРЖКИ\n\n` +
            `Текущая задержка: ${delayMinutes} минут\n\n` +
            `Введите новое время задержки в минутах (1-1440):`;

        await ctx.reply(
            message,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'delayed_messages_menu')]
            ])
        );

        await database.updateUser(userId, {
            awaiting_input: 'delayed_message_delay'
        });

    } catch (error) {
        console.error('❌ Error loading delayed message settings:', error);
        await ctx.reply('❌ Ошибка при загрузке настроек.');
    }
}

/**
 * Обработчик отмены создания
 */
export async function handleDelayedMessageCancel(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    await database.updateUser(userId, {
        awaiting_input: null,
        temp_delayed_message_name: null,
        temp_delayed_message_text_en: null,
        temp_delayed_message_text_de: null,
        temp_delayed_message_image: null
    });

    await ctx.reply('❌ Создание отложенного сообщения отменено.');
    await handleDelayedMessages(ctx);
}

/**
 * Обработчик отмены редактирования
 */
export async function handleDelayedMessageCancelEdit(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    const user = await database.getUser(userId);
    const messageId = user.temp_edit_message_id;

    await database.updateUser(userId, {
        awaiting_input: null,
        temp_edit_message_id: null
    });

    await ctx.reply('❌ Редактирование отменено.');

    if (messageId) {
        ctx.match = [null, messageId];
        await handleViewDelayedMessageDetails(ctx);
    } else {
        await handleDelayedMessageList(ctx);
    }
}

/**
 * Форматирование превью отложенного сообщения
 */
async function formatDelayedMessagePreview(message, language) {
    const text = language === 'de' ? message.text_de : message.text_en;
    let preview = `📝 **Текст:**\n${text || 'Нет текста'}`;
    
    if (message.image_url) {
        preview += `\n\n🖼️ **Изображение:**\n${message.image_url}`;
    }
    
    if (message.buttons && message.buttons.length > 0) {
        preview += `\n\n🔗 **Кнопки:**`;
        message.buttons.forEach((button, index) => {
            preview += `\n${index + 1}. ${button.text} → ${button.url}`;
        });
    }
    
    // Форматирование даты создания
    let dateStr = 'Не указано';
    if (message.created_at) {
        try {
            const createdDate = message.created_at.toDate ? message.created_at.toDate() : new Date(message.created_at);
            if (createdDate instanceof Date && !isNaN(createdDate.getTime())) {
                dateStr = createdDate.toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        } catch (error) {
            console.error('❌ Error formatting date:', error);
        }
    }
    preview += `\n\n📅 **Создано:** ${dateStr}`;
    
    // Получение информации об авторе
    let authorStr = 'Не указано';
    if (message.created_by) {
        try {
            const author = await database.getUser(message.created_by);
            if (author) {
                authorStr = author.first_name || author.username || `ID: ${message.created_by}`;
            } else {
                authorStr = `ID: ${message.created_by}`;
            }
        } catch (error) {
            console.error('❌ Error getting author:', error);
            authorStr = `ID: ${message.created_by}`;
        }
    }
    preview += `\n👤 **Автор:** ${authorStr}`;
    
    return preview;
}

/**
 * Обработчик ввода данных для отложенных сообщений
 */
export async function handleDelayedMessageInput(ctx, inputText) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    try {
        const user = await database.getUser(userId);
        const awaitingInput = user.awaiting_input;

        if (awaitingInput === 'delayed_message_name') {
            await handleDelayedMessageNameInput(ctx, inputText);
        } else if (awaitingInput === 'delayed_message_text_en') {
            await handleDelayedMessageTextInput(ctx, inputText, 'en');
        } else if (awaitingInput === 'delayed_message_text_de') {
            await handleDelayedMessageTextInput(ctx, inputText, 'de');
        } else if (awaitingInput === 'delayed_message_image') {
            await handleDelayedMessageImageInput(ctx, inputText);
        } else if (awaitingInput === 'delayed_message_buttons') {
            await handleDelayedMessageButtonsInput(ctx, inputText);
        } else if (awaitingInput === 'delayed_message_edit_text_en') {
            await handleEditTextEnInput(ctx, inputText);
        } else if (awaitingInput === 'delayed_message_edit_text_de') {
            await handleEditTextDeInput(ctx, inputText);
        } else if (awaitingInput === 'delayed_message_edit_image') {
            await handleEditImageInput(ctx, inputText);
        } else if (awaitingInput === 'delayed_message_edit_buttons') {
            await handleEditButtonsInput(ctx, inputText);
        } else if (awaitingInput === 'delayed_message_delay') {
            await handleDelayedMessageDelayInput(ctx, inputText);
        }
    } catch (error) {
        console.error('❌ Error processing delayed message input:', error);
        await ctx.reply('❌ Ошибка при обработке ввода.');
    }
}

/**
 * Обработка ввода названия
 */
async function handleDelayedMessageNameInput(ctx, inputText) {
    const userId = ctx.from.id;

    if (inputText.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Создание отменено.');
        return;
    }

    await database.updateUser(userId, {
        temp_delayed_message_name: inputText,
        awaiting_input: 'delayed_message_text_en'
    });

    await ctx.reply(
        '📝 Введите текст отложенного сообщения на английском языке:\n\n' +
        'Пример:\n' +
        '🎰 Play and win big at Hertzbet!\n\n' +
        '💰 Get up to 500€ welcome bonus!\n' +
        '🎁 Free spins waiting for you!',
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'delayed_message_cancel')]
        ])
    );
}

/**
 * Обработка ввода текста
 */
async function handleDelayedMessageTextInput(ctx, inputText, language) {
    const userId = ctx.from.id;

    if (inputText.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Создание отменено.');
        return;
    }

    const fieldName = `temp_delayed_message_text_${language}`;

    await database.updateUser(userId, {
        [fieldName]: inputText
    });

    if (language === 'en') {
        await database.updateUser(userId, {
            awaiting_input: 'delayed_message_text_de'
        });

        await ctx.reply(
            '📝 Введите текст отложенного сообщения на немецком языке:\n\n' +
            'Пример:\n' +
            '🎰 Spielen und groß gewinnen bei Hertzbet!\n\n' +
            '💰 Bis zu 500€ Willkommensbonus!\n' +
            '🎁 Freispiele warten auf Sie!',
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'delayed_message_cancel')]
            ])
        );
    } else {
        await database.updateUser(userId, {
            awaiting_input: 'delayed_message_image'
        });

        await ctx.reply(
            '🖼️ Введите URL изображения (или "skip"):\n\n' +
            'Пример: https://example.com/image.jpg',
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'delayed_message_cancel')]
            ])
        );
    }
}

/**
 * Обработка ввода изображения
 */
async function handleDelayedMessageImageInput(ctx, inputText) {
    const userId = ctx.from.id;

    if (inputText.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Создание отменено.');
        return;
    }

    let imageUrl = null;
    if (inputText.toLowerCase() !== 'skip') {
        imageUrl = inputText.trim();
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            await ctx.reply('❌ Неверный URL. Он должен начинаться с http:// или https://');
            return;
        }
    }

    await database.updateUser(userId, {
        temp_delayed_message_image: imageUrl,
        awaiting_input: 'delayed_message_buttons'
    });

    await ctx.reply(
        '🔘 Добавить кнопки? (макс 8)\n\n' +
        'Отправьте в формате:\n' +
        'Текст кнопки 1 | URL1\n' +
        'Текст кнопки 2 | URL2\n\n' +
        'Или отправьте "skip" для пропуска:',
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'delayed_message_cancel')]
        ])
    );
}

/**
 * Обработка ввода кнопок
 */
async function handleDelayedMessageButtonsInput(ctx, inputText) {
    const userId = ctx.from.id;

    if (inputText.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Создание отменено.');
        return;
    }

    const user = await database.getUser(userId);
    let buttons = [];

    if (inputText.toLowerCase() !== 'skip') {
        const lines = inputText.trim().split('\n');
        for (const line of lines) {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length === 2 && parts[0] && parts[1]) {
                buttons.push({
                    text: parts[0],
                    url: parts[1]
                });
            }
        }

        if (buttons.length > 8) {
            await ctx.reply('❌ Слишком много кнопок! Максимум 8.');
            return;
        }
    }

    const messageId = await database.createDelayedMessage({
        name: user.temp_delayed_message_name,
        text_en: user.temp_delayed_message_text_en,
        text_de: user.temp_delayed_message_text_de,
        image_url: user.temp_delayed_message_image,
        buttons: buttons,
        admin_id: userId
    });

    if (messageId) {
        await database.updateUser(userId, {
            awaiting_input: null,
            temp_delayed_message_name: null,
            temp_delayed_message_text_en: null,
            temp_delayed_message_text_de: null,
            temp_delayed_message_image: null
        });

        await ctx.reply('✅ Отложенное сообщение успешно создано!');
        await handleDelayedMessageList(ctx);
    } else {
        await ctx.reply('❌ Ошибка при создании отложенного сообщения.');
    }
}

/**
 * Обработка ввода редактирования английского текста
 */
async function handleEditTextEnInput(ctx, inputText) {
    const userId = ctx.from.id;

    if (inputText.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Редактирование отменено.');
        return;
    }

    try {
        const user = await database.getUser(userId);
        const messageId = user.temp_edit_message_id;

        if (!messageId) {
            await ctx.reply('❌ Ошибка: ID сообщения не найден.');
            return;
        }

        const success = await database.updateDelayedMessage(messageId, {
            text_en: inputText
        });

        if (success) {
            await ctx.reply('✅ Английский текст успешно обновлен!');
            
            await database.updateUser(userId, { 
                awaiting_input: null,
                temp_edit_message_id: null
            });

            ctx.match = [null, messageId];
            await handleViewDelayedMessageDetails(ctx);
        } else {
            await ctx.reply('❌ Ошибка при обновлении текста.');
        }

    } catch (error) {
        console.error('❌ Error updating EN text:', error);
        await ctx.reply('❌ Ошибка при обновлении текста.');
    }
}

/**
 * Обработка ввода редактирования немецкого текста
 */
async function handleEditTextDeInput(ctx, inputText) {
    const userId = ctx.from.id;

    if (inputText.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Редактирование отменено.');
        return;
    }

    try {
        const user = await database.getUser(userId);
        const messageId = user.temp_edit_message_id;

        if (!messageId) {
            await ctx.reply('❌ Ошибка: ID сообщения не найден.');
            return;
        }

        const success = await database.updateDelayedMessage(messageId, {
            text_de: inputText
        });

        if (success) {
            await ctx.reply('✅ Немецкий текст успешно обновлен!');
            
            await database.updateUser(userId, { 
                awaiting_input: null,
                temp_edit_message_id: null
            });

            ctx.match = [null, messageId];
            await handleViewDelayedMessageDetails(ctx);
        } else {
            await ctx.reply('❌ Ошибка при обновлении текста.');
        }

    } catch (error) {
        console.error('❌ Error updating DE text:', error);
        await ctx.reply('❌ Ошибка при обновлении текста.');
    }
}

/**
 * Обработка ввода редактирования изображения
 */
async function handleEditImageInput(ctx, inputText) {
    const userId = ctx.from.id;

    if (inputText.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Редактирование отменено.');
        return;
    }

    try {
        const user = await database.getUser(userId);
        const messageId = user.temp_edit_message_id;

        if (!messageId) {
            await ctx.reply('❌ Ошибка: ID сообщения не найден.');
            return;
        }

        let imageUrl = null;
        if (inputText.toLowerCase() !== 'skip') {
            imageUrl = inputText.trim();
            if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                await ctx.reply('❌ Неверный URL. Он должен начинаться с http:// или https://');
                return;
            }
        }

        const success = await database.updateDelayedMessage(messageId, {
            image_url: imageUrl
        });

        if (success) {
            await ctx.reply(imageUrl ? '✅ Изображение успешно обновлено!' : '✅ Изображение удалено!');
            
            await database.updateUser(userId, { 
                awaiting_input: null,
                temp_edit_message_id: null
            });

            ctx.match = [null, messageId];
            await handleViewDelayedMessageDetails(ctx);
        } else {
            await ctx.reply('❌ Ошибка при обновлении изображения.');
        }

    } catch (error) {
        console.error('❌ Error updating image:', error);
        await ctx.reply('❌ Ошибка при обновлении изображения.');
    }
}

/**
 * Обработка ввода редактирования кнопок
 */
async function handleEditButtonsInput(ctx, inputText) {
    const userId = ctx.from.id;

    if (inputText.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Редактирование отменено.');
        return;
    }

    try {
        const user = await database.getUser(userId);
        const messageId = user.temp_edit_message_id;

        if (!messageId) {
            await ctx.reply('❌ Ошибка: ID сообщения не найден.');
            return;
        }

        let buttons = [];
        if (inputText.toLowerCase() !== 'skip') {
            const lines = inputText.trim().split('\n');
            for (const line of lines) {
                const parts = line.split('|').map(p => p.trim());
                if (parts.length === 2 && parts[0] && parts[1]) {
                    buttons.push({
                        text: parts[0],
                        url: parts[1]
                    });
                }
            }

            if (buttons.length > 8) {
                await ctx.reply('❌ Слишком много кнопок! Максимум 8.');
                return;
            }
        }

        const success = await database.updateDelayedMessage(messageId, {
            buttons: buttons
        });

        if (success) {
            await ctx.reply(buttons.length > 0 ? `✅ Кнопки успешно обновлены! Добавлено: ${buttons.length}` : '✅ Кнопки удалены!');
            
            await database.updateUser(userId, { 
                awaiting_input: null,
                temp_edit_message_id: null
            });

            ctx.match = [null, messageId];
            await handleViewDelayedMessageDetails(ctx);
        } else {
            await ctx.reply('❌ Ошибка при обновлении кнопок.');
        }

    } catch (error) {
        console.error('❌ Error updating buttons:', error);
        await ctx.reply('❌ Ошибка при обновлении кнопок.');
    }
}

/**
 * Обработка ввода времени задержки
 */
async function handleDelayedMessageDelayInput(ctx, inputText) {
    const userId = ctx.from.id;

    if (inputText.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Изменение отменено.');
        return;
    }

    try {
        const delayMinutes = parseInt(inputText.trim());
        
        if (isNaN(delayMinutes) || delayMinutes < 1 || delayMinutes > 1440) {
            await ctx.reply('❌ Неверное значение! Введите число от 1 до 1440 минут.');
            return;
        }

        await database.updateSettings({
            delayed_message_delay_minutes: delayMinutes
        });

        await database.updateUser(userId, { awaiting_input: null });

        await ctx.reply(`✅ Время задержки обновлено: ${delayMinutes} минут`);

        console.log(`✅ Delayed message delay updated to ${delayMinutes} minutes by ${userId}`);

    } catch (error) {
        console.error('❌ Error updating delay:', error);
        await ctx.reply('❌ Ошибка при обновлении времени задержки.');
    }
}

export function registerDelayedMessageHandlers(bot) {
    bot.action('delayed_messages_menu', adminMiddleware, handleDelayedMessages);
    bot.action('delayed_message_create', adminMiddleware, handleCreateDelayedMessage);
    bot.action('delayed_message_list', adminMiddleware, handleDelayedMessageList);
    bot.action('delayed_message_settings', adminMiddleware, handleDelayedMessageSettings);
    
    bot.action('delayed_message_cancel', adminMiddleware, handleDelayedMessageCancel);
    bot.action('delayed_message_cancel_edit', adminMiddleware, handleDelayedMessageCancelEdit);
    
    bot.action(/delayed_message_view_(.+)/, adminMiddleware, handleViewDelayedMessageDetails);
    
    bot.action(/delayed_message_edit_text_(.+)/, adminMiddleware, handleEditDelayedMessageText);
    bot.action(/delayed_message_edit_text_en_(.+)/, adminMiddleware, handleEditDelayedMessageTextEn);
    bot.action(/delayed_message_edit_text_de_(.+)/, adminMiddleware, handleEditDelayedMessageTextDe);
    bot.action(/delayed_message_edit_image_(.+)/, adminMiddleware, handleEditDelayedMessageImage);
    bot.action(/delayed_message_edit_buttons_(.+)/, adminMiddleware, handleEditDelayedMessageButtons);
    bot.action(/delayed_message_edit_(.+)/, adminMiddleware, handleEditDelayedMessage);
    
    bot.action(/delayed_message_delete_(.+)/, adminMiddleware, handleDeleteDelayedMessage);
    bot.action(/delayed_message_confirm_delete_(.+)/, adminMiddleware, handleConfirmDeleteDelayedMessage);

    console.log('✅ Delayed message handlers registered');
}

