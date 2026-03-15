const TelegramBot = require('node-telegram-bot-api');
const { buildBotResponse } = require('./botEngine');
const { getOrCreateSession, saveSession } = require('./sessionStore');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function startTelegramBot() {
  if (!TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN not set — Telegram bot disabled.');
    return null;
  }

  const bot = new TelegramBot(TOKEN, { polling: true });
  console.log('🤖 Telegram bot started (polling mode)');

  // Handle /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const sid = `tg_${chatId}`;
    const session = await getOrCreateSession(sid);

    // Reset session for fresh start
    session.step = 0;
    session.leadData = {};
    session.history = [];
    await saveSession(sid, session);

    const result = await buildBotResponse(session, '', {});
    await saveSession(sid, session);
    sendReply(bot, chatId, result);
  });

  // Handle all regular text messages
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const sid = `tg_${chatId}`;
    const session = await getOrCreateSession(sid);

    const result = await buildBotResponse(session, msg.text, {});
    await saveSession(sid, session);
    sendReply(bot, chatId, result);
  });

  // Handle errors gracefully
  bot.on('polling_error', (err) => {
    console.error('Telegram polling error:', err.message);
  });

  return bot;
}

function sendReply(bot, chatId, result) {
  const text = result.message || '';

  // Format markdown for Telegram (bold)
  const telegramText = text.replace(/\*\*(.*?)\*\*/g, '*$1*');

  const opts = {
    parse_mode: 'Markdown',
  };

  // If there are quick reply options, show them as a keyboard
  if (result.quick_replies && result.quick_replies.length > 0) {
    opts.reply_markup = {
      keyboard: result.quick_replies.map((r) => [{ text: r }]),
      resize_keyboard: true,
      one_time_keyboard: true,
    };
  } else if (result.type === 'complete' || !result.quick_replies) {
    // Remove the keyboard once conversation is done or no options
    opts.reply_markup = { remove_keyboard: true };
  }

  bot.sendMessage(chatId, telegramText, opts).catch((err) => {
    console.error('Failed to send Telegram message:', err.message);
  });
}

module.exports = { startTelegramBot };
