import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { Telegraf } from 'telegraf';
import { setupBotCommands } from './bot-setup';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token && process.env.NODE_ENV !== 'production') {
  console.warn('TELEGRAM_BOT_TOKEN is not defined in the environment variables.');
}

// Next.js will only be used to SEND messages.
// Polling for commands is now handled by the standalone bot.mjs script.
export const bot = token ? new Telegraf(token) : null;

export function initBot() {
  // No-op for Next.js to prevent polling conflicts.
  // The standalone bot handles polling.
}

// Enable graceful stop
process.once('SIGINT', () => bot?.stop('SIGINT'));
process.once('SIGTERM', () => bot?.stop('SIGTERM'));

// Helper function to send a message to a specific chat ID using native fetch
export async function sendTelegramNotification(chatId: string | number, message: string) {
  const cleanToken = token?.replace(/^"|"$/g, '');
  if (!cleanToken) {
    console.error('Telegram bot token is not defined. Cannot send message.');
    return { success: false, error: 'Token not initialized' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Telegram API responded with ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return { success: true, result: data.result };
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
    return { success: false, error };
  }
}
