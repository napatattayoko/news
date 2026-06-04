import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix IPv6 timeout issues natively by telling Node to prefer IPv4
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

async function getFinvizData() {
  try {
    // Fetch News
    const newsRes = await fetch('http://localhost:3000/api/finviz?action=news', { signal: AbortSignal.timeout(5000) });
    const marketRes = await fetch('http://localhost:3000/api/finviz?action=market', { signal: AbortSignal.timeout(5000) });
    
    let finvizNews = fallbackNews;
    let finvizTrends = fallbackMarketTrends;

    if (newsRes.ok) {
      const newsData = await newsRes.json();
      if (newsData.success && newsData.data.length > 0) {
        finvizNews = newsData.data.map(n => ({
          headline: n.title,
          body: `Time: ${n.time} | Source: ${n.source}`,
          tickers: []
        }));
      }
    }

    if (marketRes.ok) {
      const marketData = await marketRes.json();
      if (marketData.success && marketData.data) {
        const { gainers } = marketData.data;
        finvizTrends = gainers.map(g => ({
          symbol: g.symbol,
          name: 'Finviz Top Gainer',
          sentiment: 'up',
          impactLevel: 'high',
          score: parseFloat(g.change) || 5
        }));
      }
    }

    return { finvizNews, finvizTrends };
  } catch (err) {
    console.error('Failed to fetch from Finviz API for bot:', err);
  }
  return { finvizNews: fallbackNews, finvizTrends: fallbackMarketTrends };
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
  const { finvizNews } = await getFinvizData();
  const topNews = finvizNews.slice(0, 3);
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
  const { finvizTrends } = await getFinvizData();
  const topTrends = finvizTrends.slice(0, 5);
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
    await sendMessage(chatId, `Commands available:\n/start - Get your Chat ID and Menu\n/news - Get latest news\n/market - Get market trends\n/logout - Unlink your account\n/ping - Check if the bot is alive.`);
    return;
  }

  if (text === '/logout' || text === '/unlink') {
    const db = readDb();
    let found = false;
    for (const [userId, user] of Object.entries(db.users)) {
      if (user.telegramChatId === chatId) {
        delete user.telegramChatId;
        found = true;
      }
    }
    
    if (found) {
      writeDb(db);
      await sendMessage(chatId, '✅ <b>Successfully unlinked!</b>\nYour Telegram account has been disconnected from the dashboard. You will no longer receive alerts.\n\nUse /link <PIN> to connect again.');
      console.log(`Unlinked chat ${chatId}`);
    } else {
      await sendMessage(chatId, '⚠️ Your account is not currently linked to any dashboard.');
    }
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

const seenNewsIds = new Set();
let isFirstNewsPoll = true;

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}

async function pollNews() {
  try {
    const res = await fetch('http://localhost:3000/api/news');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.news) {
        const db = readDb();
        const reversedNews = [...data.news].reverse();
        
        for (const item of reversedNews) {
          if (!seenNewsIds.has(item.id)) {
            seenNewsIds.add(item.id);
            
            if (!isFirstNewsPoll) {
              const isHighImpact = item.impact === 'high';
              
              for (const [userId, user] of Object.entries(db.users)) {
                if (user.telegramChatId) {
                  const tracked = user.trackedSymbols || [];
                  const isWatchlist = item.tickers?.some(t => tracked.includes(t.symbol));
                  
                  if (isHighImpact || isWatchlist) {
                    const typeLabel = (isWatchlist && isHighImpact) ? '🔥 High Impact Watchlist Alert' : isHighImpact ? '⚡ High Impact News Alert' : '🔔 Watchlist News Alert';
                    const tickersText = item.tickers?.length ? `\n<i>Related: ${item.tickers.map(t => `$${t.symbol}`).join(', ')}</i>` : '';
                    let message = `<b>${typeLabel}</b>\n\n<b>${escapeHTML(item.headline)}</b>${tickersText}`;
                    if (item.sources && item.sources.length > 0 && item.sources[0].url) {
                       message += `\n\n<a href="${item.sources[0].url}">Read more</a>`;
                    }
                    await sendMessage(user.telegramChatId, message);
                  }
                }
              }
            }
          }
        }
        isFirstNewsPoll = false;
      }
    }
  } catch (err) {
    if (err.message && !err.message.includes('fetch failed')) {
      console.error('Error polling news for bot:', err.message);
    }
  }
  
  setTimeout(pollNews, 15000); // Check every 15 seconds
}

console.log('⏳ Starting Stable Telegram Bot polling...');
poll();
pollNews(); // Start background news polling
