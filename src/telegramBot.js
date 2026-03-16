const TelegramBot = require('node-telegram-bot-api');
const { buildBotResponse } = require('./botEngine');
const { getOrCreateSession, saveSession } = require('./sessionStore');
const { upsertLead } = require('./leadService');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function startTelegramBot() {
  if (!TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN not set — Telegram bot disabled.');
    return null;
  }

  const bot = new TelegramBot(TOKEN, { polling: true });
  console.log('🤖 Telegram bot started (polling mode)');

  // Get bot info for the Telegram link
  let botUsername = '';
  bot.getMe().then(me => {
    botUsername = me.username;
  });

  // Handle /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const sid = `tg_${chatId}`;
    const session = await getOrCreateSession(sid);

    // Reset session for fresh start
    session.step = 0;
    session.leadData = {};
    session.history = [];
    session.source = 'telegram';
    await saveSession(sid, session);

    const result = await buildBotResponse(session, '', {});
    await saveSession(sid, session);
    sendReply(bot, chatId, result, botUsername);
  });

  // Handle all regular text messages
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const sid = `tg_${chatId}`;
    const session = await getOrCreateSession(sid);

    const result = await buildBotResponse(session, msg.text, {});
    await saveSession(sid, session);
    
    // Save lead to DB if we have data
    await upsertLead(sid, session, {});

    sendReply(bot, chatId, result, botUsername);
  });

  // Handle errors gracefully
  bot.on('polling_error', (err) => {
    console.error('Telegram polling error:', err.message);
  });

  return bot;
}

function sendReply(bot, chatId, result, botUsername) {
  const text = result.message || '';

  // Format markdown for Telegram (bold)
  const telegramText = text.replace(/\*\*(.*?)\*\*/g, '*$1*');

  const opts = {
    parse_mode: 'Markdown',
  };

  // 1. Regular Reply Keyboard (for quick replies)
  if (result.quick_replies && result.quick_replies.length > 0) {
    opts.reply_markup = {
      keyboard: result.quick_replies.map((r) => [{ text: r }]),
      resize_keyboard: true,
      one_time_keyboard: true,
    };
  } else {
    opts.reply_markup = { remove_keyboard: true };
  }

  // 2. Inline Keyboard (for external links)
  const inlineButtons = [];

  // WhatsApp Bridge
  if (result.wa_link) {
    inlineButtons.push([{ text: '💬 Chat on WhatsApp', url: result.wa_link }]);
  }

  // Social Media Links (if it's the final message or requested)
  if (result.is_complete || (result.social_links && result.message.toLowerCase().includes('social'))) {
    const socialRow = [];
    if (result.social_links.facebook) socialRow.push({ text: 'FB', url: result.social_links.facebook });
    if (result.social_links.instagram) socialRow.push({ text: 'IG', url: result.social_links.instagram });
    if (result.social_links.youtube) socialRow.push({ text: 'YT', url: result.social_links.youtube });
    if (socialRow.length > 0) inlineButtons.push(socialRow);
  }

  // Telegram Bot Link (Symbol/Link)
  if (botUsername && (result.is_complete || result.wa_link)) {
    inlineButtons.push([{ text: '🤖 Back to Telegram Bot', url: `https://t.me/${botUsername}` }]);
  }

  if (inlineButtons.length > 0) {
    // Merge inline_keyboard into reply_markup
    // NOTE: Telegram allows EITHER a reply_keyboard OR an inline_keyboard in a single message's reply_markup.
    // However, we can send the message with an inline_keyboard and it doesn't conflict with any active reply_keyboard.
    opts.reply_markup.inline_keyboard = inlineButtons;
  }

  bot.sendMessage(chatId, telegramText, opts).catch((err) => {
    console.error('Failed to send Telegram message:', err.message);
  });
}

module.exports = { startTelegramBot };
