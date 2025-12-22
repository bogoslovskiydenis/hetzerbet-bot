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
 * Главное меню управления уведомлениями
 */
export async function handleNotifications(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    console.log(`📢 User ${userId} opened notifications management`);

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(
            t('admin.notifications.create_new', lang),
            'notification_create'
        )],
        [Markup.button.callback(
            t('admin.notifications.view_list', lang),
            'notification_list'
        )],
        [Markup.button.callback(
            t('admin.notifications.test_send', lang),
            'notification_test'
        )],
        [Markup.button.callback(
            t('admin.button_back', lang),
            'admin_back'
        )]
    ]);

    await ctx.editMessageText(
        '📢 УПРАВЛЕНИЕ УВЕДОМЛЕНИЯМИ\n\n' +
        'Здесь вы можете создавать и редактировать шаблоны уведомлений.',
        keyboard
    );
}

/**
 * Создание нового уведомления
 */
export async function handleCreateNotification(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    await ctx.reply(
        '➕ СОЗДАНИЕ УВЕДОМЛЕНИЯ\n\n' +
        'Введите название уведомления:\n\n' +
        'Пример: "Welcome Bonus Promo"',
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'notification_cancel')]
        ])
    );

    // Устанавливаем состояние ожидания
    await database.updateUser(userId, {
        awaiting_input: 'notification_name'
    });
}

/**
 * Список уведомлений
 */
export async function handleNotificationList(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    try {
        const templates = await database.getNotificationTemplates();

        if (templates.length === 0) {
            await ctx.reply(
                '📋 СПИСОК УВЕДОМЛЕНИЙ\n\n' +
                'Уведомления не найдены.\n\n' +
                'Создайте первое уведомление, нажав "➕ Создать уведомление"'
            );
            return;
        }

        let message = '📋 СПИСОК УВЕДОМЛЕНИЙ\n\n';
        
        templates.forEach((template, index) => {
            message += `${index + 1}. ${template.name}\n`;
            message += `   📝 ${template.text_en.substring(0, 50)}...\n`;
            message += `   🖼️ ${template.image_url ? 'Есть' : 'Нет'}\n`;
            message += `   🔘 Кнопок: ${template.buttons?.length || 0}\n\n`;
        });

        // Создаем кнопки для каждого уведомления
        const keyboard = [];
        templates.forEach((template, index) => {
            keyboard.push([
                Markup.button.callback(
                    `👁️ ${template.name}`,
                    `notification_view_${template.id}`
                )
            ]);
        });

        keyboard.push([Markup.button.callback('◀️ Назад', 'admin_notifications')]);

        await ctx.reply(message, Markup.inlineKeyboard(keyboard));

    } catch (error) {
        console.error('❌ Error loading notification list:', error);
        await ctx.reply('❌ Ошибка при загрузке списка уведомлений.');
    }
}

/**
 * Редактирование уведомления
 */
export async function handleEditNotification(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const templateId = ctx.match[1];

    await ctx.answerCbQuery();

    try {
        const template = await database.getNotificationTemplate(templateId);

        if (!template) {
            await ctx.reply('❌ Уведомление не найдено.');
            return;
        }

        const message = `✏️ РЕДАКТИРОВАНИЕ УВЕДОМЛЕНИЯ\n\n` +
            `📝 Название: ${template.name}\n` +
            `🇬🇧 EN: ${template.text_en}\n` +
            `🇩🇪 DE: ${template.text_de}\n` +
            `🖼️ Изображение: ${template.image_url || 'Нет'}\n` +
            `🔘 Кнопок: ${template.buttons?.length || 0}\n\n` +
            `Выберите действие:`;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('📝 Изменить текст', `notification_edit_text_${templateId}`)],
            [Markup.button.callback('🖼️ Изменить изображение', `notification_edit_image_${templateId}`)],
            [Markup.button.callback('🔘 Изменить кнопки', `notification_edit_buttons_${templateId}`)],
            [Markup.button.callback('🗑️ Удалить', `notification_delete_${templateId}`)],
            [Markup.button.callback('◀️ Назад', 'notification_list')]
        ]);

        await ctx.editMessageText(message, keyboard);

    } catch (error) {
        console.error('❌ Error editing notification:', error);
        await ctx.reply('❌ Ошибка при редактировании уведомления.');
    }
}

/**
 * Тестовая отправка уведомления
 */
export async function handleTestNotification(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    try {
        // Получаем случайный шаблон
        const template = await database.getRandomNotificationTemplate(lang);

        if (!template) {
            await ctx.reply('❌ Нет активных шаблонов уведомлений для тестирования.');
            return;
        }

        // Отправляем тестовое уведомление
        if (template.image_url) {
            await ctx.replyWithPhoto(
                template.image_url,
                {
                    caption: `🧪 ТЕСТОВОЕ УВЕДОМЛЕНИЕ\n\n${template.text}`,
                    ...Markup.inlineKeyboard(template.buttons.map(btn => 
                        [Markup.button.url(btn.text, btn.url)]
                    ))
                }
            );
        } else {
            await ctx.reply(
                `🧪 ТЕСТОВОЕ УВЕДОМЛЕНИЕ\n\n${template.text}`,
                Markup.inlineKeyboard(template.buttons.map(btn => 
                    [Markup.button.url(btn.text, btn.url)]
                ))
            );
        }

        await ctx.reply('✅ Тестовое уведомление отправлено!');

    } catch (error) {
        console.error('❌ Error sending test notification:', error);
        await ctx.reply('❌ Ошибка при отправке тестового уведомления.');
    }
}

/**
 * Обработчик редактирования текста уведомления
 */
export async function handleEditNotificationText(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const templateId = ctx.match[1];

    await ctx.answerCbQuery();

    try {
        const template = await database.getNotificationTemplate(templateId);
        
        if (!template) {
            await ctx.reply('❌ Уведомление не найдено.');
            return;
        }

        await ctx.reply(
            `📝 РЕДАКТИРОВАНИЕ ТЕКСТА\n\n` +
            `Текущий текст:\n` +
            `🇬🇧 EN: ${template.text_en}\n\n` +
            `🇩🇪 DE: ${template.text_de}\n\n` +
            `Выберите язык для редактирования:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🇬🇧 Редактировать английский', `notification_edit_text_en_${templateId}`)],
                [Markup.button.callback('🇩🇪 Редактировать немецкий', `notification_edit_text_de_${templateId}`)],
                [Markup.button.callback('◀️ Назад', `notification_view_${templateId}`)]
            ])
        );

    } catch (error) {
        console.error('❌ Error editing notification text:', error);
        await ctx.reply('❌ Ошибка при редактировании текста.');
    }
}

/**
 * Обработчик редактирования английского текста
 */
export async function handleEditNotificationTextEn(ctx) {
    const userId = ctx.from.id;
    const templateId = ctx.match[1];

    await ctx.answerCbQuery();

    try {
        const template = await database.getNotificationTemplate(templateId);
        
        if (!template) {
            await ctx.reply('❌ Уведомление не найдено.');
            return;
        }

        await ctx.reply(
            `🇬🇧 РЕДАКТИРОВАНИЕ АНГЛИЙСКОГО ТЕКСТА\n\n` +
            `Текущий текст:\n${template.text_en}\n\n` +
            `Введите новый текст на английском языке:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'notification_cancel_edit')]
            ])
        );

        // Сохраняем ID шаблона для редактирования
        await database.updateUser(userId, {
            awaiting_input: 'notification_edit_text_en',
            temp_edit_template_id: templateId
        });

    } catch (error) {
        console.error('❌ Error editing EN text:', error);
        await ctx.reply('❌ Ошибка при редактировании текста.');
    }
}

/**
 * Обработчик редактирования немецкого текста
 */
export async function handleEditNotificationTextDe(ctx) {
    const userId = ctx.from.id;
    const templateId = ctx.match[1];

    await ctx.answerCbQuery();

    try {
        const template = await database.getNotificationTemplate(templateId);
        
        if (!template) {
            await ctx.reply('❌ Уведомление не найдено.');
            return;
        }

        await ctx.reply(
            `🇩🇪 РЕДАКТИРОВАНИЕ НЕМЕЦКОГО ТЕКСТА\n\n` +
            `Текущий текст:\n${template.text_de}\n\n` +
            `Введите новый текст на немецком языке:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'notification_cancel_edit')]
            ])
        );

        // Сохраняем ID шаблона для редактирования
        await database.updateUser(userId, {
            awaiting_input: 'notification_edit_text_de',
            temp_edit_template_id: templateId
        });

    } catch (error) {
        console.error('❌ Error editing DE text:', error);
        await ctx.reply('❌ Ошибка при редактировании текста.');
    }
}

/**
 * Обработчик редактирования изображения
 */
export async function handleEditNotificationImage(ctx) {
    const userId = ctx.from.id;
    const templateId = ctx.match[1];

    await ctx.answerCbQuery();

    try {
        const template = await database.getNotificationTemplate(templateId);
        
        if (!template) {
            await ctx.reply('❌ Уведомление не найдено.');
            return;
        }

        await ctx.reply(
            `🖼️ РЕДАКТИРОВАНИЕ ИЗОБРАЖЕНИЯ\n\n` +
            `Текущее изображение: ${template.image_url || 'Нет'}\n\n` +
            `Введите новый URL изображения или 'skip' для удаления:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'notification_cancel_edit')]
            ])
        );

        // Сохраняем ID шаблона для редактирования
        await database.updateUser(userId, {
            awaiting_input: 'notification_edit_image',
            temp_edit_template_id: templateId
        });

    } catch (error) {
        console.error('❌ Error editing image:', error);
        await ctx.reply('❌ Ошибка при редактировании изображения.');
    }
}

/**
 * Обработчик редактирования кнопок
 */
export async function handleEditNotificationButtons(ctx) {
    const userId = ctx.from.id;
    const templateId = ctx.match[1];

    await ctx.answerCbQuery();

    try {
        const template = await database.getNotificationTemplate(templateId);
        
        if (!template) {
            await ctx.reply('❌ Уведомление не найдено.');
            return;
        }

        let currentButtons = 'Нет кнопок';
        if (template.buttons && template.buttons.length > 0) {
            currentButtons = template.buttons.map((btn, index) => 
                `${index + 1}. ${btn.text} → ${btn.url}`
            ).join('\n');
        }

        await ctx.reply(
            `🔘 РЕДАКТИРОВАНИЕ КНОПОК\n\n` +
            `Текущие кнопки:\n${currentButtons}\n\n` +
            `Введите новые кнопки в формате:\n` +
            `Текст | URL\n` +
            `Текст | URL\n\n` +
            `Или введите 'skip' для удаления всех кнопок\n` +
            `Максимум 8 кнопок`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'notification_cancel_edit')]
            ])
        );

        // Сохраняем ID шаблона для редактирования
        await database.updateUser(userId, {
            awaiting_input: 'notification_edit_buttons',
            temp_edit_template_id: templateId
        });

    } catch (error) {
        console.error('❌ Error editing buttons:', error);
        await ctx.reply('❌ Ошибка при редактировании кнопок.');
    }
}

/**
 * Обработчик просмотра деталей уведомления
 */
export async function handleViewNotificationDetails(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    
    try {
        const templateId = ctx.match[1];
        const template = await database.getNotificationTemplate(templateId);
        
        if (!template) {
            await ctx.reply('❌ Уведомление не найдено.');
            return;
        }

        const preview = await formatNotificationPreview(template, lang);
        
        await ctx.reply(
            `📋 **${template.name}**\n\n${preview}`,
            {
                parse_mode: 'Markdown',
                reply_markup: Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✏️ Редактировать', `notification_edit_${templateId}`),
                        Markup.button.callback('🗑️ Удалить', `notification_delete_${templateId}`)
                    ],
                    [Markup.button.callback('◀️ Назад к списку', 'notification_list')]
                ]).reply_markup
            }
        );

    } catch (error) {
        console.error('❌ Error viewing notification details:', error);
        await ctx.reply('❌ Ошибка при просмотре уведомления.');
    }
}

/**
 * Обработчик удаления уведомления
 */
export async function handleDeleteNotification(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    
    try {
        const templateId = ctx.match[1];
        const template = await database.getNotificationTemplate(templateId);
        
        if (!template) {
            await ctx.reply('❌ Уведомление не найдено.');
            return;
        }

        await ctx.reply(
            `🗑️ Удалить уведомление "${template.name}"?\n\nЭто действие нельзя отменить!`,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('✅ Да, удалить', `notification_confirm_delete_${templateId}`),
                    Markup.button.callback('❌ Отмена', 'notification_list')
                ]
            ])
        );

    } catch (error) {
        console.error('❌ Error handling delete notification:', error);
        await ctx.reply('❌ Ошибка при удалении уведомления.');
    }
}

/**
 * Обработчик подтверждения удаления уведомления
 */
export async function handleConfirmDeleteNotification(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    
    try {
        const templateId = ctx.match[1];
        const template = await database.getNotificationTemplate(templateId);
        
        if (!template) {
            await ctx.reply('❌ Уведомление не найдено.');
            return;
        }

        const success = await database.deleteNotificationTemplate(templateId);
        
        if (success) {
            await ctx.reply(`✅ Уведомление "${template.name}" успешно удалено!`);
            
            // Возвращаемся к списку уведомлений
            await handleNotificationList(ctx);
        } else {
            await ctx.reply('❌ Ошибка при удалении уведомления.');
        }

    } catch (error) {
        console.error('❌ Error confirming delete notification:', error);
        await ctx.reply('❌ Ошибка при удалении уведомления.');
    }
}

/**
 * Обработчик отмены создания уведомления
 */
export async function handleNotificationCancel(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    // Очищаем состояние
    await database.updateUser(userId, {
        awaiting_input: null,
        temp_notification_name: null,
        temp_notification_text_en: null,
        temp_notification_text_de: null,
        temp_notification_image: null
    });

    await ctx.reply('❌ Создание уведомления отменено.');
    
    // Возвращаемся в меню уведомлений
    await handleNotifications(ctx);
}

/**
 * Обработчик отмены редактирования уведомления
 */
export async function handleNotificationCancelEdit(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    const user = await database.getUser(userId);
    const templateId = user.temp_edit_template_id;

    // Очищаем состояние
    await database.updateUser(userId, {
        awaiting_input: null,
        temp_edit_template_id: null
    });

    await ctx.reply('❌ Редактирование отменено.');

    // Возвращаемся к просмотру уведомления, если есть templateId
    if (templateId) {
        ctx.match = [null, templateId];
        await handleViewNotificationDetails(ctx);
    } else {
        // Иначе возвращаемся к списку
        await handleNotificationList(ctx);
    }
}

/**
 * Обработчик ввода данных для уведомлений
 */
export async function handleNotificationInput(ctx, inputText) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    try {
        const user = await database.getUser(userId);
        const awaitingInput = user.awaiting_input;

        if (awaitingInput === 'notification_name') {
            await handleNotificationNameInput(ctx, inputText);
        } else if (awaitingInput === 'notification_text_en') {
            await handleNotificationTextInput(ctx, inputText, 'en');
        } else if (awaitingInput === 'notification_text_de') {
            await handleNotificationTextInput(ctx, inputText, 'de');
        } else if (awaitingInput === 'notification_image') {
            await handleNotificationImageInput(ctx, inputText);
        } else if (awaitingInput === 'notification_buttons') {
            await handleNotificationButtonsInput(ctx, inputText);
        } else if (awaitingInput === 'notification_edit_text_en') {
            await handleEditTextEnInput(ctx, inputText);
        } else if (awaitingInput === 'notification_edit_text_de') {
            await handleEditTextDeInput(ctx, inputText);
        } else if (awaitingInput === 'notification_edit_image') {
            await handleEditImageInput(ctx, inputText);
        } else if (awaitingInput === 'notification_edit_buttons') {
            await handleEditButtonsInput(ctx, inputText);
        }

    } catch (error) {
        console.error('❌ Error processing notification input:', error);
        await ctx.reply('❌ Ошибка при обработке ввода.');
    }
}

/**
 * Обработка ввода названия уведомления
 */
async function handleNotificationNameInput(ctx, name) {
    const userId = ctx.from.id;

    if (name.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Создание уведомления отменено.');
        return;
    }

    // Сохраняем название и запрашиваем английский текст
    await database.updateUser(userId, {
        awaiting_input: 'notification_text_en',
        temp_notification_name: name
    });

    await ctx.reply(
        '📝 Введите текст уведомления на английском языке:\n\n' +
        'Пример:\n' +
        '🎰 Play and win big at Hertzbet!\n\n' +
        '💰 Get up to 500€ welcome bonus!\n' +
        '🎁 Free spins waiting for you!',
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'notification_cancel')]
        ])
    );
}

/**
 * Обработка ввода текста уведомления
 */
async function handleNotificationTextInput(ctx, text, language) {
    const userId = ctx.from.id;

    if (text.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Создание уведомления отменено.');
        return;
    }

    const user = await database.getUser(userId);
    const fieldName = `temp_notification_text_${language}`;

    await database.updateUser(userId, {
        [fieldName]: text
    });

    if (language === 'en') {
        // Запрашиваем немецкий текст
        await database.updateUser(userId, {
            awaiting_input: 'notification_text_de'
        });

        await ctx.reply(
            '📝 Введите текст уведомления на немецком языке:\n\n' +
            'Пример:\n' +
            '🎰 Spielen und groß gewinnen bei Hertzbet!\n\n' +
            '💰 Bis zu 500€ Willkommensbonus!\n' +
            '🎁 Freispiele warten auf Sie!',
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'notification_cancel')]
            ])
        );
    } else {
        // Запрашиваем изображение
        await database.updateUser(userId, {
            awaiting_input: 'notification_image'
        });

        await ctx.reply(
            '🖼️ Введите URL изображения (или "пропустить"):\n\n' +
            'Пример: https://example.com/image.jpg',
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отмена', 'notification_cancel')]
            ])
        );
    }
}

/**
 * Обработка ввода изображения
 */
async function handleNotificationImageInput(ctx, imageUrl) {
    const userId = ctx.from.id;

    if (imageUrl.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Создание уведомления отменено.');
        return;
    }

    const imageUrlToSave = imageUrl.toLowerCase() === 'пропустить' ? null : imageUrl;

    await database.updateUser(userId, {
        awaiting_input: 'notification_buttons',
        temp_notification_image: imageUrlToSave
    });

    await ctx.reply(
        '🔘 Введите кнопки (или "пропустить"):\n\n' +
        'Формат: Текст кнопки | URL\n' +
        'Пример:\n' +
        '🎰 Играть | https://hertzbet.com\n' +
        '🎁 Бонус | https://hertzbet.com/bonus',
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'notification_cancel')]
        ])
    );
}

/**
 * Обработка ввода кнопок и создание уведомления
 */
async function handleNotificationButtonsInput(ctx, buttonsText) {
    const userId = ctx.from.id;

    if (buttonsText.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply('❌ Создание уведомления отменено.');
        return;
    }

    try {
        const user = await database.getUser(userId);
        
        // Парсим кнопки
        let buttons = [];
        if (buttonsText.toLowerCase() !== 'пропустить') {
            const buttonLines = buttonsText.split('\n').filter(line => line.trim());
            buttons = buttonLines.map(line => {
                const [text, url] = line.split('|').map(s => s.trim());
                return { text, url };
            }).filter(btn => btn.text && btn.url);
        }

        // Создаем уведомление
        const templateId = await database.createNotificationTemplate({
            name: user.temp_notification_name,
            text_en: user.temp_notification_text_en,
            text_de: user.temp_notification_text_de,
            image_url: user.temp_notification_image,
            buttons: buttons,
            admin_id: userId
        });

        if (templateId) {
            // Очищаем временные данные
            await database.updateUser(userId, {
                awaiting_input: null,
                temp_notification_name: null,
                temp_notification_text_en: null,
                temp_notification_text_de: null,
                temp_notification_image: null
            });

            await ctx.reply(
                '✅ Уведомление успешно создано!\n\n' +
                `📝 Название: ${user.temp_notification_name}\n` +
                `🔘 Кнопок: ${buttons.length}\n` +
                `🖼️ Изображение: ${user.temp_notification_image ? 'Есть' : 'Нет'}`
            );
        } else {
            await ctx.reply('❌ Ошибка при создании уведомления.');
        }

    } catch (error) {
        console.error('❌ Error creating notification:', error);
        await ctx.reply('❌ Ошибка при создании уведомления.');
    }
}


/**
 * Регистрация обработчиков уведомлений
 */
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
        const templateId = user.temp_edit_template_id;

        if (!templateId) {
            await ctx.reply('❌ Ошибка: ID шаблона не найден.');
            return;
        }

        // Обновляем английский текст
        const success = await database.updateNotificationTemplate(templateId, {
            text_en: inputText
        });

        if (success) {
            await ctx.reply('✅ Английский текст успешно обновлен!');
            
            // Очищаем состояние
            await database.updateUser(userId, { 
                awaiting_input: null,
                temp_edit_template_id: null
            });

            // Возвращаемся к просмотру уведомления
            ctx.match = [null, templateId];
            await handleViewNotificationDetails(ctx);
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
        const templateId = user.temp_edit_template_id;

        if (!templateId) {
            await ctx.reply('❌ Ошибка: ID шаблона не найден.');
            return;
        }

        // Обновляем немецкий текст
        const success = await database.updateNotificationTemplate(templateId, {
            text_de: inputText
        });

        if (success) {
            await ctx.reply('✅ Немецкий текст успешно обновлен!');
            
            // Очищаем состояние
            await database.updateUser(userId, { 
                awaiting_input: null,
                temp_edit_template_id: null
            });

            // Возвращаемся к просмотру уведомления
            ctx.match = [null, templateId];
            await handleViewNotificationDetails(ctx);
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
        const templateId = user.temp_edit_template_id;

        if (!templateId) {
            await ctx.reply('❌ Ошибка: ID шаблона не найден.');
            return;
        }

        let imageUrl = null;
        if (inputText.toLowerCase() !== 'skip') {
            imageUrl = inputText;
        }

        // Обновляем изображение
        const success = await database.updateNotificationTemplate(templateId, {
            image_url: imageUrl
        });

        if (success) {
            await ctx.reply('✅ Изображение успешно обновлено!');
            
            // Очищаем состояние
            await database.updateUser(userId, { 
                awaiting_input: null,
                temp_edit_template_id: null
            });

            // Возвращаемся к просмотру уведомления
            ctx.match = [null, templateId];
            await handleViewNotificationDetails(ctx);
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
        const templateId = user.temp_edit_template_id;

        if (!templateId) {
            await ctx.reply('❌ Ошибка: ID шаблона не найден.');
            return;
        }

        let buttons = [];
        if (inputText.toLowerCase() !== 'skip') {
            const buttonLines = inputText.split('\n').filter(line => line.trim());
            
            if (buttonLines.length > 8) {
                await ctx.reply('❌ Слишком много кнопок! Максимум 8 кнопок.');
                return;
            }

            buttons = buttonLines.map(line => {
                const [text, url] = line.split('|').map(s => s.trim());
                return { text, url };
            }).filter(btn => btn.text && btn.url);

            if (buttons.length !== buttonLines.length) {
                await ctx.reply('❌ Неверный формат кнопок! Используйте: Текст | URL');
                return;
            }
        }

        // Обновляем кнопки
        const success = await database.updateNotificationTemplate(templateId, {
            buttons: buttons
        });

        if (success) {
            await ctx.reply('✅ Кнопки успешно обновлены!');
            
            // Очищаем состояние
            await database.updateUser(userId, { 
                awaiting_input: null,
                temp_edit_template_id: null
            });

            // Возвращаемся к просмотру уведомления
            ctx.match = [null, templateId];
            await handleViewNotificationDetails(ctx);
        } else {
            await ctx.reply('❌ Ошибка при обновлении кнопок.');
        }

    } catch (error) {
        console.error('❌ Error updating buttons:', error);
        await ctx.reply('❌ Ошибка при обновлении кнопок.');
    }
}

/**
 * Форматирование превью уведомления
 */
async function formatNotificationPreview(template, language) {
    const text = language === 'de' ? template.text_de : template.text_en;
    let preview = `📝 **Текст:**\n${text}`;
    
    if (template.image_url) {
        preview += `\n\n🖼️ **Изображение:**\n${template.image_url}`;
    }
    
    if (template.buttons && template.buttons.length > 0) {
        preview += `\n\n🔗 **Кнопки:**`;
        template.buttons.forEach((button, index) => {
            preview += `\n${index + 1}. ${button.text} → ${button.url}`;
        });
    }
    
    // Дата создания
    let dateStr = 'Не указано';
    if (template.created_at) {
        try {
            const createdDate = template.created_at.toDate ? template.created_at.toDate() : new Date(template.created_at);
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
            console.error('❌ Error formatting notification date:', error);
        }
    }
    preview += `\n\n📅 **Создано:** ${dateStr}`;
    
    // Автор
    let authorStr = 'Не указано';
    const authorId = template.created_by || template.admin_id;
    if (authorId) {
        try {
            const author = await database.getUser(authorId);
            if (author) {
                authorStr = author.first_name || author.username || `ID: ${authorId}`;
            } else {
                authorStr = `ID: ${authorId}`;
            }
        } catch (error) {
            console.error('❌ Error getting notification author:', error);
            authorStr = `ID: ${authorId}`;
        }
    }
    preview += `\n👤 **Автор:** ${authorStr}`;
    
    return preview;
}

export function registerNotificationHandlers(bot) {
    bot.action('admin_notifications', adminMiddleware, handleNotifications);
    bot.action('notification_create', adminMiddleware, handleCreateNotification);
    bot.action('notification_list', adminMiddleware, handleNotificationList);
    bot.action('notification_test', adminMiddleware, handleTestNotification);
    
    // Отмена создания/редактирования
    bot.action('notification_cancel', adminMiddleware, handleNotificationCancel);
    bot.action('notification_cancel_edit', adminMiddleware, handleNotificationCancelEdit);
    
    // Просмотр деталей уведомления
    bot.action(/notification_view_(.+)/, adminMiddleware, handleViewNotificationDetails);
    
    // Редактирование уведомлений
    bot.action(/notification_edit_text_(.+)/, adminMiddleware, handleEditNotificationText);
    bot.action(/notification_edit_text_en_(.+)/, adminMiddleware, handleEditNotificationTextEn);
    bot.action(/notification_edit_text_de_(.+)/, adminMiddleware, handleEditNotificationTextDe);
    bot.action(/notification_edit_image_(.+)/, adminMiddleware, handleEditNotificationImage);
    bot.action(/notification_edit_buttons_(.+)/, adminMiddleware, handleEditNotificationButtons);
    bot.action(/notification_edit_(.+)/, adminMiddleware, handleEditNotification);
    
    // Удаление уведомлений
    bot.action(/notification_delete_(.+)/, adminMiddleware, handleDeleteNotification);
    bot.action(/notification_confirm_delete_(.+)/, adminMiddleware, handleConfirmDeleteNotification);

    console.log('✅ Notification handlers registered');
}

