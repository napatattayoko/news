import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { NewsItem, Category } from '@/lib/types';

// HTTP headers sent with requests to make them look like a real web browser.
// This helps prevent Finviz from blocking our scraping requests.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};


/**
 * Simple sentiment analysis helper.
 * Scans a headline for positive or negative words.
 * If no keywords are found, it uses the headline length as a fallback.
 */
const detectSentiment = (title: string) => {
  const lower = title.toLowerCase();
  const goodWords = ['up', 'higher', 'surge', 'gain', 'buy', 'beat', 'strong', 'rally', 'dividend', 'upgrade', 'jump', 'soar', 'record', 'profit'];
  const badWords = ['down', 'lower', 'plunge', 'drop', 'sell', 'miss', 'weak', 'crash', 'cut', 'downgrade', 'fall', 'sink', 'lawsuit', 'probe', 'loss'];
  for (const word of goodWords) if (lower.match(new RegExp(`\\b${word}\\b`))) return 'good';
  for (const word of badWords) if (lower.match(new RegExp(`\\b${word}\\b`))) return 'bad';
  return title.length % 3 === 0 ? 'good' : title.length % 3 === 1 ? 'bad' : 'neutral';
};

// Map of common company names to their official stock ticker symbols.
const COMPANY_TO_TICKER: Record<string, string> = {
  'apple': 'AAPL', 'tesla': 'TSLA', 'nvidia': 'NVDA', 'microsoft': 'MSFT',
  'google': 'GOOGL', 'alphabet': 'GOOGL', 'amazon': 'AMZN', 'meta': 'META',
  'facebook': 'META', 'netflix': 'NFLX', 'disney': 'DIS', 'boeing': 'BA',
  'intel': 'INTC', 'amd': 'AMD',
};

/**
 * Extracts stock ticker symbols from a news headline.
 * 1. Finds words in all UPPERCASE (length 2-5) that are not common English words.
 * 2. Matches known company names to their tickers.
 * 3. Falls back to a deterministic guess if no tickers are found.
 */
const extractTickers = (title: string) => {
  const words = title.split(/[\s,.'"-]+/);
  // Match words that are fully uppercase (e.g., AAPL) and ignore common words like "THE" or "AND"
  const possibleTickers = words.filter(w => w === w.toUpperCase() && w.length >= 2 && w.length <= 5 && !['THE', 'FOR', 'AND', 'WITH', 'FROM'].includes(w));

  // Match companies by name (e.g., if title contains "apple", add "AAPL")
  const lowerTitle = title.toLowerCase();
  for (const [company, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    if (lowerTitle.match(new RegExp(`\\b${company}\\b`))) {
      possibleTickers.push(ticker);
    }
  }

  // Fallback: If no tickers were found, pick a popular one deterministically based on title length
  if (possibleTickers.length === 0) {
    const popular = ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'AMZN', 'GOOGL'];
    const charCode = title.length > 0 ? title.charCodeAt(0) : 0;
    const deterministicIndex = (title.length + charCode) % popular.length;
    if ((title.length + charCode) % 2 === 0) {
      possibleTickers.push(popular[deterministicIndex]);
    }
  }

  // Remove duplicates, limit to 2 tickers, and format as object with sentiments
  return Array.from(new Set(possibleTickers)).slice(0, 2).map(symbol => ({
    symbol,
    name: symbol,
    sentiment: detectSentiment(title) === 'good' ? 'up' as const : detectSentiment(title) === 'bad' ? 'down' as const : 'flat' as const,
    sentimentScore: detectSentiment(title) === 'good' ? 5 : detectSentiment(title) === 'bad' ? -5 : 0
  }));
};

// Keywords that suggest a headline has a major/critical market impact.
const HIGH_IMPACT_KEYWORDS = [
  'bankrupt', 'bankruptcy', 'crash', 'plunge', 'soar', 'surge',
  'fed', 'fomc', 'rate cut', 'rate hike', 'inflation', 'cpi',
  'resigns', 'steps down', 'fired', 'layoffs',
  'merger', 'acquires', 'buyout', 'acquisition',
  'lawsuit', 'sues', 'sec probe', 'investigation', 'guilty',
  'war', 'missile', 'attack', 'strike', 'emergency',
  'record high', 'all-time high', 'halts', 'scandal'
];

// Keywords that suggest a headline has a medium market impact.
const MEDIUM_IMPACT_KEYWORDS = [
  'earnings', 'revenue', 'profit', 'sales', 'dividend',
  'upgrade', 'downgrade', 'partnership', 'invests', 'announces',
  'launch', 'appoints', 'guidance', 'estimates', 'ceo', 'cfo',
  'lawmaker', 'bill', 'signs'
];

/**
 * Determines the market impact level (high, medium, low) of a headline.
 * Looks for high/medium keywords first, then falls back to title length.
 */
const calculateImpact = (title: string) => {
  const lowerTitle = title.toLowerCase();
  for (const keyword of HIGH_IMPACT_KEYWORDS) {
    if (lowerTitle.includes(keyword)) return 'high';
  }
  for (const keyword of MEDIUM_IMPACT_KEYWORDS) {
    if (lowerTitle.includes(keyword)) return 'medium';
  }
  // Length fallbacks: longer titles usually contain more detailed, higher impact news
  if (title.length > 80) return 'high';
  if (title.length > 40) return 'medium';
  return 'low';
};

/**
 * Parses a Finviz timestamp string into a standard UTC ISO format.
 * Examples of Finviz timestamps:
 * - "Today 04:30PM"
 * - "Jun-12-26 09:15AM"
 * - "09:15AM" (Uses the last known date)
 */
function parseFinvizTime(timeStr: string, lastDateObj: { year: number, month: number, day: number }) {
  try {
    const parts = timeStr.trim().split(' ');
    let datePart = '';
    let timePart = '';
    if (parts.length >= 2) {
      if (parts[0].toLowerCase() === 'today') { timePart = parts[1]; }
      else { datePart = parts[0]; timePart = parts[1]; }
    } else {
      timePart = parts[0];
    }

    let year = lastDateObj.year; let month = lastDateObj.month; let day = lastDateObj.day;
    if (datePart) {
      const dateSplit = datePart.split('-');
      if (dateSplit.length === 3) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        month = monthNames.findIndex(m => m.toLowerCase() === dateSplit[0].toLowerCase());
        day = parseInt(dateSplit[1], 10);
        year = parseInt(dateSplit[2], 10);
        if (year < 100) year += 2000;
      }
    }

    let hours = 0; let mins = 0;
    if (timePart) {
      const match = timePart.match(/(\d+):(\d+)(AM|PM)/i);
      if (match) {
        hours = parseInt(match[1], 10); mins = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    }
    const dateAsUTC = new Date(Date.UTC(year, month, day, hours, mins, 0));
    const actualUTC = new Date(dateAsUTC.getTime() + 5 * 60 * 60 * 1000); // EST to UTC
    let isoString = actualUTC.toISOString();
    if (actualUTC.getTime() > Date.now()) { isoString = new Date().toISOString(); }
    return { isoString, newDateObj: { year, month, day } };
  } catch (e) {
    return { isoString: new Date().toISOString(), newDateObj: lastDateObj };
  }
}

import PipelineSingleton from '@/lib/ai';
import { getCategoryCache, saveCategoryCache } from '@/lib/cache';

// 📡 Data Fetching Functions
/**
 * Scrapes general market news headlines from Finviz news page.
 */
async function fetchNews() {
  const response = await fetch('https://finviz.com/news.ashx', { headers: HEADERS, next: { revalidate: 60 } });
  if (!response.ok) throw new Error('Failed to fetch news');
  const html = await response.text();
  const $ = cheerio.load(html);

  // Initialize dates using New York timezone (EST/EDT) as Finviz uses Eastern Time
  const nyDateStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const nyDate = new Date(nyDateStr);
  let currentDateObj = { year: nyDate.getFullYear(), month: nyDate.getMonth(), day: nyDate.getDate() };

  const rawNews: NewsItem[] = [];
  $('table.styled-table-new tr').each((i, row) => {
    const time = $(row).find('td.news_date-cell').text().trim();
    const linkEl = $(row).find('a.nn-tab-link');
    const title = linkEl.text().trim();
    const url = linkEl.attr('href');

    if (title && url) {
      const uniqueId = Buffer.from(title).toString('base64').replace(/\W/g, '').substring(0, 30);
      const parsedTime = parseFinvizTime(time, currentDateObj);
      currentDateObj = parsedTime.newDateObj;

      rawNews.push({
        id: `fv-news-${uniqueId}`,
        headline: title,
        body: `Published at: ${time}. Sourced from Finviz.`,
        publishedAt: parsedTime.isoString,
        sentiment: detectSentiment(title),
        impact: calculateImpact(title),
        countryCode: 'global',
        regionTag: 'global',
        category: 'markets', // Default, will be updated by AI/Cache
        tickers: extractTickers(title),
        sources: [{ name: 'Finviz', url }]
      });
    }
  });

  const newsSlice = rawNews.slice(0, 50);

  // AI & Cache Processing
  const cache = getCategoryCache();
  const candidateLabels = [
    'economy', 'geopolitics', 'tech', 'ai', 'energy', 
    'commodities', 'healthcare', 'real-estate', 'climate', 
    'defense', 'banking', 'automotive', 'trade', 'entertainment'
  ];
  const uncachedItems = newsSlice.filter(item => !cache[item.id]);

  if (uncachedItems.length > 0) {
    try {
      console.log(`[AI] Categorizing ${uncachedItems.length} new articles...`);
      const aiPipeline = await PipelineSingleton.getInstance();
      
      for (const item of uncachedItems) {
        // Zero-shot classification with multi_label and hypothesis template
        const result = await aiPipeline(item.headline, candidateLabels, { 
          multi_label: true,
          hypothesis_template: "This news article is about {}."
        });
        
        // Check confidence score of the top predicted label
        const topLabel = result.labels[0] as Category;
        const topScore = result.scores[0];
        
        // With multi_label: true, scores are independent sigmoids.
        // If confidence > 45%, assign the category, otherwise fallback to 'markets'
        if (topScore > 0.45) {
          cache[item.id] = topLabel;
        } else {
          cache[item.id] = 'markets';
        }
      }
      saveCategoryCache(cache);
      console.log(`[AI] Categorization complete and cached!`);
    } catch (error) {
      console.error("[AI] Error during categorization:", error);
    }
  }

  // Apply categories from cache
  const finalNews = newsSlice.map(item => ({
    ...item,
    category: (cache[item.id] as Category) || 'markets'
  }));

  return finalNews;
}

/**
 * Scrapes top gaining and losing stocks from the Finviz homepage.
 */
async function fetchMarket() {
  const response = await fetch('https://finviz.com/', { headers: HEADERS, next: { revalidate: 600 } });
  if (!response.ok) throw new Error('Failed to fetch market data');
  const html = await response.text();
  const $ = cheerio.load(html);
  const gainers: any[] = [];
  const losers: any[] = [];

  // Scrape Top Gainers (First styled table on the page)
  $('table.styled-table-new').eq(0).find('tr').each((i, row) => {
    if (i === 0) return;
    const cols = $(row).find('td');
    if (cols.length >= 6) {
      gainers.push({
        symbol: $(cols[0]).text().trim(),
        last: $(cols[1]).text().trim(),
        change: $(cols[2]).text().trim(),
        volume: $(cols[3]).text().trim(),
      });
    }
  });

  // Scrape Top Losers (Second styled table on the page)
  $('table.styled-table-new').eq(1).find('tr').each((i, row) => {
    if (i === 0) return;
    const cols = $(row).find('td');
    if (cols.length >= 6) {
      losers.push({
        symbol: $(cols[0]).text().trim(),
        last: $(cols[1]).text().trim(),
        change: $(cols[2]).text().trim(),
        volume: $(cols[3]).text().trim(),
      });
    }
  });

  return { gainers: gainers.slice(0, 10), losers: losers.slice(0, 10) };
}

/**
 * Scrapes stock detailed metrics and news headlines for a specific ticker symbol.
 */
async function fetchQuote(symbol: string) {
  const response = await fetch(`https://finviz.com/quote.ashx?t=${symbol}`, { headers: HEADERS, next: { revalidate: 600 } });
  if (!response.ok) throw new Error('Failed to fetch quote');
  const html = await response.text();
  const $ = cheerio.load(html);

  // Scrape key metrics table (P/E, EPS, Beta, etc.)
  const quoteData: Record<string, string> = {};
  $('.snapshot-table2 tr').each((i, row) => {
    const cols = $(row).find('td');
    for (let j = 0; j < cols.length; j += 2) {
      const key = $(cols[j]).text().trim();
      const val = $(cols[j + 1]).text().trim();
      if (key) quoteData[key] = val;
    }
  });

  // Initialize dates using New York timezone (EST/EDT)
  const nyDateStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const nyDate = new Date(nyDateStr);
  let currentDateObj = { year: nyDate.getFullYear(), month: nyDate.getMonth(), day: nyDate.getDate() };

  // Scrape company-specific news headlines
  const stockNews: NewsItem[] = [];
  $('#news-table tr').each((i, row) => {
    const time = $(row).find('td').first().text().trim();
    const a = $(row).find('a.tab-link-news');
    const title = a.text().trim();
    const url = a.attr('href');

    if (title && url) {
      const parsedTime = parseFinvizTime(time, currentDateObj);
      currentDateObj = parsedTime.newDateObj;
      const sentimentResult = detectSentiment(title);

      stockNews.push({
        id: `fv-quote-${symbol}-${i}`,
        headline: title,
        body: `Published at: ${time}. Sourced from Finviz.`,
        publishedAt: parsedTime.isoString,
        sentiment: sentimentResult,
        impact: 'medium', // Default to medium for stock specific news to show in detailed view easily
        countryCode: 'us',
        regionTag: 'us',
        category: 'markets',
        tickers: [{
          symbol: symbol,
          name: symbol,
          sentiment: sentimentResult === 'good' ? 'up' : sentimentResult === 'bad' ? 'down' : 'flat',
          sentimentScore: sentimentResult === 'good' ? 5 : sentimentResult === 'bad' ? -5 : 0
        }],
        sources: [{ name: 'Finviz', url }]
      });
    }
  });

  return { quote: quoteData, news: stockNews.slice(0, 10) };
}

// 🚀 Main API Router

/**
 * Handles incoming GET requests and routes to the appropriate scraper function.
 * Query Parameters:
 * - action: 'news' | 'market' | 'quote'
 * - symbol: Required if action is 'quote' (e.g. 'AAPL')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'news';

    if (action === 'news') {
      const data = await fetchNews();
      return NextResponse.json({ success: true, data });
    } else if (action === 'market') {
      const data = await fetchMarket();
      return NextResponse.json({ success: true, data });
    } else if (action === 'quote') {
      const symbol = searchParams.get('symbol');
      if (!symbol) return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
      const data = await fetchQuote(symbol);
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Finviz Scraping Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
