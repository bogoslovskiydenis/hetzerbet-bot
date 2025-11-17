import { Markup } from 'telegraf';
import { database } from '../../config/services/database.js';
import { t } from '../../locales/i18n.js';
import { adminMiddleware } from './index.js';

async function getUserLanguage(userId) {
    const user = await database.getUser(userId);
    return user?.language || 'en';
}

function getBotUsername(ctx) {
    return ctx.botInfo?.username ||
        global?.bot?.botInfo?.username ||
        process.env.BOT_USERNAME ||
        'your_bot';
}

export async function handlePromoLinksMenu(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(
            t('admin.promolinks.create_new', lang),
            'promolinks_create'
        )],
        [Markup.button.callback(
            t('admin.promolinks.list', lang),
            'promolinks_list'
        )],
        [Markup.button.callback(
            t('admin.button_back', lang),
            'admin_back'
        )]
    ]);

    await ctx.editMessageText(
        t('admin.promolinks.menu_title', lang),
        keyboard
    );
}

export async function handlePromoLinkCreate(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    await database.updateUser(userId, {
        awaiting_input: 'promo_link_create'
    });

    await ctx.reply(t('admin.promolinks.input_format', lang));
}

export async function handlePromoLinkInput(ctx, inputText) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    if (inputText.toLowerCase() === '/cancel') {
        await database.updateUser(userId, { awaiting_input: null });
        await ctx.reply(t('admin.promolinks.cancelled', lang));
        return;
    }

    const parts = inputText.trim().split(/\s+/);

    if (parts.length < 2) {
        await ctx.reply(t('admin.promolinks.invalid_format', lang));
        return;
    }

    const slug = parts[0].toLowerCase();
    const description = parts.slice(1).join(' ').trim();

    if (!/^[a-z0-9_-]{3,30}$/.test(slug)) {
        await ctx.reply(t('admin.promolinks.invalid_slug', lang));
        return;
    }

    if (!description || description.length < 3) {
        await ctx.reply(t('admin.promolinks.description_required', lang));
        return;
    }

    const result = await database.createPromoLink({
        slug,
        description,
        admin_id: userId
    });

    if (!result.success) {
        if (result.error === 'slug_exists') {
            await ctx.reply(t('admin.promolinks.slug_exists', lang));
        } else {
            await ctx.reply(t('errors.general', lang));
        }
        return;
    }

    const botUsername = getBotUsername(ctx);
    const link = `https://t.me/${botUsername}?start=promo_${slug}`;

    await database.updateUser(userId, { awaiting_input: null });

    await ctx.reply(
        t('admin.promolinks.created', lang, {
            slug,
            description,
            link
        })
    );
}

export async function handlePromoLinksList(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);

    await ctx.answerCbQuery();

    const links = await database.getPromoLinks();

    if (!links.length) {
        await ctx.reply(t('admin.promolinks.list_empty', lang));
        return;
    }

    const botUsername = getBotUsername(ctx);

    const message = links.map((linkData, index) => {
        const link = `https://t.me/${botUsername}?start=promo_${linkData.slug}`;
        return t('admin.promolinks.list_item', lang, {
            index: index + 1,
            slug: linkData.slug,
            description: linkData.description,
            clicks: linkData.total_clicks || 0,
            link
        });
    }).join('\n\n');

    const buttons = links.map(linkData => ([
        Markup.button.callback(
            `🗑 ${linkData.slug}`,
            `promolinks_delete_${linkData.slug}`
        )
    ]));

    buttons.push([Markup.button.callback(
        t('admin.button_back', lang),
        'admin_promolinks'
    )]);

    await ctx.reply(
        message,
        Markup.inlineKeyboard(buttons)
    );
}

export async function handlePromoLinkDelete(ctx) {
    const userId = ctx.from.id;
    const lang = await getUserLanguage(userId);
    const slug = ctx.match[1];

    await ctx.answerCbQuery(t('admin.promolinks.deleting', lang));

    const result = await database.deletePromoLink(slug);

    if (!result.success) {
        const errorText = result.error === 'not_found'
            ? t('admin.promolinks.delete_not_found', lang)
            : t('errors.general', lang);

        await ctx.answerCbQuery(errorText, { show_alert: true });
        return;
    }

    await ctx.answerCbQuery(t('admin.promolinks.deleted', lang), { show_alert: true });
    await handlePromoLinksList(ctx);
}

export function registerPromoLinksHandlers(bot) {
    bot.action('admin_promolinks', adminMiddleware, handlePromoLinksMenu);
    bot.action('promolinks_create', adminMiddleware, handlePromoLinkCreate);
    bot.action('promolinks_list', adminMiddleware, handlePromoLinksList);
    bot.action(/promolinks_delete_(.+)/, adminMiddleware, handlePromoLinkDelete);

    console.log('✅ Promo link handlers registered');
}

