import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';
import { analyzeArticle, categorizeArticle } from '../lib/ai';
const COMMON_TICKERS = new Set([
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK', 'LLY', 'V',
  'TSM', 'JPM', 'UNH', 'WMT', 'JNJ', 'MA', 'PG', 'HD', 'AVGO', 'CVX', 'MRK', 'KO',
  'PEP', 'COST', 'ABBV', 'BAC', 'CRM', 'MCD', 'CSCO', 'ACN', 'TMO', 'LIN', 'NFLX',
  'ABT', 'DHR', 'AMD', 'CMCSA', 'NKE', 'DIS', 'TXN', 'WFC', 'VZ', 'PM', 'NEE',
  'RTX', 'INTC', 'HON', 'QCOM', 'IBM', 'BA', 'GE', 'GS', 'CAT', 'UBER', 'MU',
  'ARM', 'SMCI', 'PLTR', 'SNOW', 'COIN', 'ROKU', 'SQ', 'SHOP', 'SPOT', 'DELL', 'HPQ'
]);

const COMPANY_TICKER_MAP: Record<string, string> = {
  'apple': 'AAPL', 'microsoft': 'MSFT', 'nvidia': 'NVDA', 'google': 'GOOGL', 'alphabet': 'GOOGL',
  'amazon': 'AMZN', 'meta': 'META', 'facebook': 'META', 'tesla': 'TSLA', 'berkshire': 'BRK',
  'lilly': 'LLY', 'visa': 'V', 'tsmc': 'TSM', 'jpmorgan': 'JPM', 'unitedhealth': 'UNH',
  'walmart': 'WMT', 'johnson & johnson': 'JNJ', 'mastercard': 'MA', 'procter': 'PG',
  'home depot': 'HD', 'broadcom': 'AVGO', 'chevron': 'CVX', 'merck': 'MRK', 'coca-cola': 'KO',
  'pepsico': 'PEP', 'costco': 'COST', 'abbvie': 'ABBV', 'bank of america': 'BAC', 'salesforce': 'CRM',
  'mcdonald': 'MCD', 'cisco': 'CSCO', 'accenture': 'ACN', 'netflix': 'NFLX', 'abbott': 'ABT',
  'amd': 'AMD', 'comcast': 'CMCSA', 'nike': 'NKE', 'disney': 'DIS', 'texas instruments': 'TXN',
  'wells fargo': 'WFC', 'verizon': 'VZ', 'intel': 'INTC', 'qualcomm': 'QCOM', 'ibm': 'IBM',
  'boeing': 'BA', 'goldman sachs': 'GS', 'caterpillar': 'CAT', 'uber': 'UBER', 'micron': 'MU',
  'arm': 'ARM', 'palantir': 'PLTR', 'snowflake': 'SNOW', 'coinbase': 'COIN', 'roku': 'ROKU',
  'square': 'SQ', 'shopify': 'SHOP', 'spotify': 'SPOT', 'dell': 'DELL', 'hp': 'HPQ', 'bayer': 'BAYRY'
};

// Extract potential stock tickers
function extractTickers(title: string): string[] {
  const match = title.match(/\b[A-Z]{2,5}\b/g);
  let tickers = match ? Array.from(new Set(match)).filter(word => COMMON_TICKERS.has(word)) : [];

  // Scan for company names in the headline
  for (const [company, ticker] of Object.entries(COMPANY_TICKER_MAP)) {
    const regex = new RegExp(`\\b${company}\\b`, 'i');
    if (regex.test(title)) {
      tickers.push(ticker);
    }
  }

  return Array.from(new Set(tickers));
}

// Helper to parse New York local date components into a correct UTC Date object
function getUtcFromNewYork(year: number, month: number, day: number, hours: number, minutes: number): Date {
  const targetString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  const utcDate = new Date(targetString + 'Z');
  
  // Format the mock UTC date using America/New_York timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(utcDate);
  const partVal = (type: string) => parseInt(parts.find(p => p.type === type)!.value, 10);
  
  const nyYear = partVal('year');
  const nyMonth = partVal('month') - 1;
  const nyDay = partVal('day');
  const nyHour = partVal('hour') === 24 ? 0 : partVal('hour');
  const nyMin = partVal('minute');
  
  // Calculate timezone offset difference
  const dateNy = Date.UTC(nyYear, nyMonth, nyDay, nyHour, nyMin);
  const diff = dateNy - utcDate.getTime();
  
  return new Date(utcDate.getTime() - diff);
}

// Parse Finviz time format (interpreting it as New York Time)
function parseFinvizTime(timeStr: string, currentDateObj: { year: number, month: number, day: number }) {
  let newDateObj = { ...currentDateObj };
  let hours = 0;
  let mins = 0;

  const parts = timeStr.trim().split(' ');
  let datePart = '';
  let timePart = '';

  if (parts.length >= 2) {
    if (parts[0].toLowerCase() === 'today') {
      timePart = parts[1];
      const nyDateStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
      const nyDate = new Date(nyDateStr);
      newDateObj = { year: nyDate.getFullYear(), month: nyDate.getMonth(), day: nyDate.getDate() };
    } else {
      datePart = parts[0];
      timePart = parts[1];
    }
  } else {
    if (parts[0].includes('-')) {
      datePart = parts[0];
      hours = 0;
      mins = 0;
    } else {
      timePart = parts[0];
    }
  }

  if (datePart && datePart.includes('-')) {
    const datePieces = datePart.split('-');
    if (datePieces.length === 2) {
      const monthMap: Record<string, number> = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
      const parsedMonth = monthMap[datePieces[0]];
      const parsedDay = parseInt(datePieces[1], 10);
      if (parsedMonth !== undefined && !isNaN(parsedDay)) {
        newDateObj.month = parsedMonth;
        newDateObj.day = parsedDay;
        if (currentDateObj.month === 0 && parsedMonth === 11) newDateObj.year--;
        else if (currentDateObj.month === 11 && parsedMonth === 0) newDateObj.year++;
      }
    }
  }

  if (timePart) {
    const isPM = timePart.toLowerCase().includes('pm');
    const isAM = timePart.toLowerCase().includes('am');
    const timeOnly = timePart.replace(/am|pm/i, '').trim();
    const timeParts = timeOnly.split(':');

    if (timeParts.length === 2) {
      let parsedHours = parseInt(timeParts[0], 10);
      const parsedMins = parseInt(timeParts[1], 10);
      if (!isNaN(parsedHours) && !isNaN(parsedMins)) {
        if (isPM && parsedHours < 12) parsedHours += 12;
        if (isAM && parsedHours === 12) parsedHours = 0;
        hours = parsedHours;
        mins = parsedMins;
      }
    }
  }

  try {
    const calculatedDate = getUtcFromNewYork(newDateObj.year, newDateObj.month, newDateObj.day, hours, mins);
    return { newDateObj, isoString: calculatedDate.toISOString() };
  } catch (err) {
    return { newDateObj, isoString: new Date().toISOString() };
  }
}

const candidateLabels = [
  'economy', 'geopolitics', 'tech', 'ai', 'energy',
  'commodities', 'healthcare', 'real-estate', 'climate',
  'defense', 'banking', 'automotive', 'trade', 'entertainment'
];

export async function scrapeAndStoreNews() {
  console.log(`[NewsBot] Starting scraping process...`);
  try {
    const url = 'https://finviz.com/news.ashx';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      throw new Error(`Finviz responded with status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse NY time
    const nyOffset = -4; // EDT
    const nowUtc = new Date();
    const nyDateStr = new Date(nowUtc.getTime() + (nyOffset * 3600 * 1000)).toLocaleString("en-US", { timeZone: "UTC" });
    const nyDate = new Date(nyDateStr);

    let currentDateObj = { year: nyDate.getFullYear(), month: nyDate.getMonth(), day: nyDate.getDate() };
    const rawNews: any[] = [];

    $('table.styled-table-new tr').each((i, row) => {
      const time = $(row).find('td.news_date-cell').text().trim();
      const linkEl = $(row).find('a.nn-tab-link');
      const title = linkEl.text().trim();
      const newsUrl = linkEl.attr('href');

      if (title && newsUrl) {
        const uniqueId = Buffer.from(title).toString('base64').replace(/\W/g, '').substring(0, 30);
        const parsedTime = parseFinvizTime(time, currentDateObj);
        currentDateObj = parsedTime.newDateObj;

        rawNews.push({
          id: `fv-news-${uniqueId}`,
          headline: title,
          body: `Published at: ${time}. Sourced from Finviz.`,
          publishedAt: parsedTime.isoString,
          countryCode: 'global',
          regionTag: 'global',
          tickers: extractTickers(title),
          sources: [{ name: 'Finviz', url: newsUrl }]
        });
      }
    });

    console.log(`[NewsBot] Scraped ${rawNews.length} articles from Finviz. Checking DB for new ones...`);

    const existingIds = await prisma.news.findMany({
      where: {
        id: { in: rawNews.map(n => n.id) }
      },
      select: { id: true }
    });

    const existingIdSet = new Set(existingIds.map(n => n.id));
    const newArticles = rawNews.filter(n => !existingIdSet.has(n.id));

    console.log(`[NewsBot] Found ${newArticles.length} NEW articles. Need to categorize via AI...`);

    if (newArticles.length > 0) {
      const BATCH_SIZE = 5;
      for (let i = 0; i < newArticles.length; i += BATCH_SIZE) {
        const batch = newArticles.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (item) => {
          try {
            console.log(`[NewsBot] Categorizing & Analyzing: "${item.headline.substring(0, 50)}..."`);

            // 1. Categorize using HF API (facebook/bart-large-mnli)
            const catResult = await categorizeArticle(item.headline, candidateLabels);
            item.category = catResult.score > 0.45 ? catResult.label : 'markets';

            // 2. Analyze Sentiment & Impact using HF API (ProsusAI/finbert)
            const analysis = await analyzeArticle(item.headline, item.body);
            item.sentiment = analysis.sentiment;
            item.impact = analysis.impact;

            await prisma.news.upsert({
              where: { id: item.id },
              update: {},
              create: {
                id: item.id,
                headline: item.headline,
                body: item.body,
                publishedAt: new Date(item.publishedAt),
                category: item.category,
                impact: item.impact,
                sentiment: item.sentiment,
                countryCode: item.countryCode,
                regionTag: item.regionTag,
                tickers: JSON.stringify(item.tickers),
                sources: JSON.stringify(item.sources)
              }
            });
          } catch (err) {
            console.error(`[NewsBot] Error processing article ${item.id}:`, err);
          }
        }));
      }
      console.log(`[NewsBot] Successfully processed ${newArticles.length} articles!`);
    } else {
      console.log(`[NewsBot] No new articles found. DB is up to date.`);
    }

  } catch (error) {
    console.error(`[NewsBot] Error in scraping job:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script directly if called via command line
if (require.main === module) {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  const runContinuously = async () => {
    console.log(`[NewsBot] Starting continuous scraping mode (runs every 5 minutes)...`);
    while (true) {
      await scrapeAndStoreNews();
      console.log(`[NewsBot] Sleeping for 5 minutes before the next check...`);
      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
    }
  };

  runContinuously();
}
