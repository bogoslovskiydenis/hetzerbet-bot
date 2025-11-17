import { getSubscriptionKeyboard as getSubKeyboard } from '../utils/keyboards.js';
import { t } from '../locales/i18n.js';
import { database } from '../config/services/database.js';

/**
 * ID или username канала для проверки подписки
 * 
 * Варианты настройки REQUIRED_CHANNEL:
 * 1. Публичный канал: "@channelname" (с @)
 * 2. Приватный канал: "-1002491686841" (chat_id, начинается с -100)
 * 3. Публичная группа: "@groupname" (с @)
 * 4. Приватная группа: "-1001234567890" (chat_id)
 * 
 * ВАЖНО: Бот ОБЯЗАТЕЛЬНО должен быть админом в канале/группе!
 * 
 * Если REQUIRED_CHANNEL не установлен или SUBSCRIPTION_CHECK_ENABLED=false,
 * проверка подписки будет отключена
 */
const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL || '@YmirTest';
const CHANNEL_INVITE_LINK = process.env.CHANNEL_INVITE_LINK || 'https://t.me/+Yf7qzUub-Lw1ZmYy';
const SUBSCRIPTION_CHECK_ENABLED = process.env.SUBSCRIPTION_CHECK_ENABLED !== 'false';

/**
 * Проверяет подписку пользователя на канал
 */
export async function checkSubscription(ctx) {
    // Если проверка подписки отключена - всегда возвращаем true
    if (!SUBSCRIPTION_CHECK_ENABLED) {
        console.log('ℹ️ Subscription check is disabled');
        return true;
    }
    
    // Если канал не указан - пропускаем проверку
    if (!REQUIRED_CHANNEL) {
        console.log('⚠️ REQUIRED_CHANNEL is not set, skipping subscription check');
        return true;
    }
    
    const userId = ctx.from.id; // Объявляем перед try-catch чтобы использовать в обоих блоках
    
    try {
        console.log(`🔍 Checking subscription for user ${userId} to channel ${REQUIRED_CHANNEL}`);
        
        const chatMember = await ctx.telegram.getChatMember(REQUIRED_CHANNEL, userId);
        
        console.log(`📊 Chat member status for user ${userId}:`, {
            status: chatMember.status,
            user: chatMember.user.username || chatMember.user.first_name
        });
        
        // Статусы: 'creator', 'administrator', 'member' - подписан
        // 'left', 'kicked' - не подписан
        const isSubscribed = ['creator', 'administrator', 'member'].includes(chatMember.status);
        
        console.log(`✅ User ${userId} subscription status: ${isSubscribed ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'}`);
        return isSubscribed;
    } catch (error) {
        console.error(`❌ Error checking subscription for user ${userId}:`, error.message);
        
        // Обработка специфичных ошибок как в вашем примере
        if (error.message.includes('user not found') ||
            error.message.includes('chat not found') ||
            error.message.includes('USER_NOT_PARTICIPANT')) {
            console.log(`❌ User ${userId} is not subscribed to channel`);
            return false;
        }
        
        // Обработка ошибок по кодам
        if (error.response?.error_code === 400) {
            console.error(`❌ Bad Request. Check if REQUIRED_CHANNEL is correct: ${REQUIRED_CHANNEL}`);
            console.error(`   Убедитесь что бот добавлен админом в канал/группу!`);
        } else if (error.response?.error_code === 403) {
            console.error(`❌ Error: Bot doesn't have permission to access the channel`);
        }
        
        // Для других ошибок считаем что не подписан (безопасное поведение)
        console.error(`❌ Unexpected error, treating as not subscribed`);
        return false;
    }
}

/**
 * Клавиатура с кнопкой подписки и проверки
 */
export function getSubscriptionKeyboard(language) {
    return getSubKeyboard(language, CHANNEL_INVITE_LINK);
}

/**
 * Middleware для проверки подписки на канал
 * Применяется к определенным командам/действиям
 */
export function subscriptionMiddleware(excludeCommands = []) {
    return async (ctx, next) => {
        // Пропускаем middleware для исключенных команд
        if (ctx.message?.text) {
            const command = ctx.message.text.split(' ')[0];
            if (excludeCommands.includes(command)) {
                return next();
            }
        }

        const userId = ctx.from.id;
        const isSubscribed = await checkSubscription(ctx);

        if (!isSubscribed) {
            // Получаем язык пользователя
            const language = ctx.session?.language || 'en';
            
            const keyboard = getSubscriptionKeyboard(language);
            await ctx.reply(
                t('subscription.not_subscribed', language),
                keyboard
            );
            await database.logButtonImpression('subscription_check');
            
            return; // Останавливаем выполнение
        }

        return next(); // Продолжаем, если подписан
    };
}

/**
 * Проверка подписки с сообщением
 * Возвращает true если подписан, false если нет
 */
export async function requireSubscription(ctx, language) {
    const isSubscribed = await checkSubscription(ctx);
    
    if (!isSubscribed) {
        const keyboard = getSubscriptionKeyboard(language);
        await ctx.reply(
            t('subscription.not_subscribed', language),
            keyboard
        );
        await database.logButtonImpression('subscription_check');
        return false;
    }
    
    return true;
}

