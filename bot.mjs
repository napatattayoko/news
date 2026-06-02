import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix IPv6 timeout issues natively by telling Node to prefer IPv4
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-load .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = process.env[key] || value;
    }
  });
}
const DB_PATH = path.join(__dirname, 'database.json');

const token = process.env.TELEGRAM_BOT_TOKEN?.replace(/^"|"$/g, '');
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is missing in .env.local');
  process.exit(1);
}

const API_URL = `https://api.telegram.org/bot${token}`;

let lastUpdateId = 0;

const fallbackNews = [
  {
    headline: 'Trump wants to squeeze Iran into peace talks with more troops',
    body: 'The White House is ramping up military deployments to the Middle East...',
    tickers: [{ symbol: 'LMT', sentiment: 'up' }, { symbol: 'XOM', sentiment: 'down' }]
  },
  {
    headline: 'The oil market is in backwardation – energy prices rising',
    body: 'Crude oil futures are trading in backwardation as near-term supply tightens...',
    tickers: [{ symbol: 'XOM', sentiment: 'up' }]
  },
  {
    headline: 'Nvidia Accelerates Data Center Dominance With Blackwell Shipments',
    body: 'NVDA begins mass shipments of GB200 Blackwell GPUs to hyperscalers...',
    tickers: [{ symbol: 'NVDA', sentiment: 'up' }]
  }
];

const fallbackMarketTrends = [
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sentiment: 'up', impactLevel: 'high', score: 2.0 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sentiment: 'up', impactLevel: 'high', score: 5.0 },
  { symbol: 'AAPL', name: 'Apple Inc.', sentiment: 'up', impactLevel: 'medium', score: 5.5 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sentiment: 'up', impactLevel: 'low', score: 1.0 },
  { symbol: 'TSLA', name: 'Tesla, Inc.', sentiment: 'down', impactLevel: 'high', score: -8.0 }
];

async function getMockData() {
  try {
    const res = await fetch('http://localhost:3000/api/telegram/mock-data', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          mockNews: data.mockNews,
          mockMarketTrends: data.mockMarketTrends
        };
      }
    }
  } catch (err) {
    // Silent fallback
  }
  return { mockNews: fallbackNews, mockMarketTrends: fallbackMarketTrends };
}

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) return { users: {}, pendingLinks: {} };
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error('Error reading database:', e);
    return { users: {}, pendingLinks: {} };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error writing database:', e);
  }
}

async function sendMessage(chatId, text) {
  try {
    await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
  } catch (err) {
    console.error('Failed to send message:', err);
  }
}

async function sendMessageWithKeyboard(chatId, text, keyboard) {
  try {
    const res = await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: keyboard
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('Failed to send keyboard message:', errText);
    }
  } catch (err) {
    console.error('Failed to send keyboard message:', err);
  }
}

async function answerCallbackQuery(callbackQueryId, text = '') {
  try {
    await fetch(`${API_URL}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text })
    });
  } catch (err) {
    console.error('Failed to answer callback query:', err);
  }
}

async function sendNewsMessage(chatId) {
  const { mockNews } = await getMockData();
  const topNews = mockNews.slice(0, 3);
  let message = '<b>📰 Latest Top News</b>\n\n';

  topNews.forEach((news, index) => {
    message += `<b>${index + 1}. ${news.headline}</b>\n`;
    message += `${news.body.substring(0, 100)}...\n`;
    if (news.tickers && news.tickers.length > 0) {
      const tickers = news.tickers.map(t => `$${t.symbol} (${t.sentiment === 'up' ? '📈' : '📉'})`).join(', ');
      message += `<i>Related: ${tickers}</i>\n`;
    }
    message += `\n`;
  });

  await sendMessageWithKeyboard(chatId, message, {
    inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'show_menu' }]]
  });
}

async function sendMarketMessage(chatId) {
  const { mockMarketTrends } = await getMockData();
  const topTrends = mockMarketTrends.slice(0, 5);
  let message = '<b>📊 Top Market Trends</b>\n\n';

  topTrends.forEach((trend) => {
    const icon = trend.sentiment === 'up' ? '🟢' : '🔴';
    message += `${icon} <b>$${trend.symbol}</b> - ${trend.name}\n`;
    message += `Impact: ${trend.impactLevel} | Score: ${trend.score}\n\n`;
  });

  await sendMessageWithKeyboard(chatId, message, {
    inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'show_menu' }]]
  });
}

async function handleMessage(message) {
  if (!message || !message.text) return;
  const text = message.text.trim();
  const chatId = message.chat.id;

  console.log(`Received message: ${text}`);

  if (text === '/start') {
    await sendMessageWithKeyboard(chatId, `Welcome to NewsMaster Bot! 📈\nYour Chat ID is: <code>${chatId}</code>\n\nPlease save this Chat ID and use it in your application settings to receive real-time stock and news notifications.`, {
      inline_keyboard: [
        [{ text: '📰 Latest News', callback_data: 'get_news' }],
        [{ text: '📊 Market Trends', callback_data: 'get_market' }]
      ]
    });
    return;
  }

  if (text === '/help') {
    await sendMessage(chatId, `Commands available:\n/start - Get your Chat ID and Menu\n/news - Get latest news\n/market - Get market trends\n/ping - Check if the bot is alive.`);
    return;
  }

  if (text === '/ping') {
    await sendMessage(chatId, 'Pong! 🏓 I am alive and listening.');
    return;
  }

  if (text === '/news') {
    await sendNewsMessage(chatId);
    return;
  }

  if (text === '/market') {
    await sendMarketMessage(chatId);
    return;
  }

  if (text.startsWith('/link')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendMessage(chatId, '❌ Please provide a PIN code. Example: /link 123456');
      return;
    }

    const pin = parts[1];
    const db = readDb();
    const userId = db.pendingLinks[pin];

    if (!userId) {
      await sendMessage(chatId, '❌ Invalid or expired PIN code. Please generate a new one on the website.');
      return;
    }

    if (!db.users[userId]) {
      db.users[userId] = { trackedSymbols: [] };
    }
    db.users[userId].telegramChatId = chatId;

    delete db.pendingLinks[pin];
    writeDb(db);

    await sendMessage(chatId, '✅ <b>Successfully linked!</b>\nYour Telegram account is now connected to your NewsMaster dashboard.');
    console.log(`Successfully linked pin ${pin} to chat ${chatId}`);
    return;
  }
}

async function handleCallbackQuery(callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const callbackQueryId = callbackQuery.id;

  console.log(`Received callback query: ${data}`);

  await answerCallbackQuery(callbackQueryId);

  if (data === 'get_news') {
    await sendNewsMessage(chatId);
    return;
  }

  if (data === 'get_market') {
    await sendMarketMessage(chatId);
    return;
  }

  if (data === 'show_menu') {
    await sendMessageWithKeyboard(chatId, '<b>Main Menu</b>\nSelect an option below:', {
      inline_keyboard: [
        [{ text: '📰 Latest News', callback_data: 'get_news' }],
        [{ text: '📊 Market Trends', callback_data: 'get_market' }]
      ]
    });
    return;
  }
}

async function poll() {
  try {
    const res = await fetch(`${API_URL}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

    const data = await res.json();

    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
        if (update.message) {
          await handleMessage(update.message);
        } else if (update.callback_query) {
          await handleCallbackQuery(update.callback_query);
        }
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('fetch failed')) {
      // Silent retry
    } else {
      console.error('Polling error:', err);
    }
  }

  // Continue polling
  setTimeout(poll, 1000);
}

console.log('⏳ Starting Stable Telegram Bot polling...');
poll();
