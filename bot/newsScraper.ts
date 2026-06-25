import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';
import PipelineSingleton from '../lib/ai';

// Simple impact calculator
function calculateImpact(title: string): 'high' | 'medium' | 'low' {
  const t = title.toLowerCase();
  if (t.includes('surge') || t.includes('plunge') || t.includes('crash') || t.includes('record')) return 'high';
  if (t.includes('rise') || t.includes('fall') || t.includes('up') || t.includes('down')) return 'medium';
  return 'low';
}

// Simple sentiment detection
function detectSentiment(title: string): 'good' | 'bad' | 'neutral' {
  const t = title.toLowerCase();
  if (t.includes('surge') || t.includes('up') || t.includes('rise') || t.includes('gain') || t.includes('record') || t.includes('bull')) return 'good';
  if (t.includes('plunge') || t.includes('down') || t.includes('fall') || t.includes('loss') || t.includes('crash') || t.includes('bear')) return 'bad';
  return 'neutral';
}

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

// Parse Finviz time format
function parseFinvizTime(timeStr: string, currentDateObj: { year: number, month: number, day: number }) {
  let newDateObj = { ...currentDateObj };
  const d = new Date();
  d.setFullYear(newDateObj.year, newDateObj.month, newDateObj.day);
  d.setSeconds(0);
  d.setMilliseconds(0);

  const parts = timeStr.trim().split(' ');
  let datePart = '';
  let timePart = '';

  if (parts.length >= 2) {
    if (parts[0].toLowerCase() === 'today') {
      timePart = parts[1];
      const now = new Date();
      newDateObj = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
      d.setFullYear(newDateObj.year, newDateObj.month, newDateObj.day);
    } else {
      datePart = parts[0];
      timePart = parts[1];
    }
  } else {
    if (parts[0].includes('-')) {
      datePart = parts[0];
      d.setHours(0, 0, 0, 0); // Default to midnight if only date is provided
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
        d.setFullYear(newDateObj.year, newDateObj.month, newDateObj.day);
      }
    }
  }

  if (timePart) {
    const isPM = timePart.toLowerCase().includes('pm');
    const isAM = timePart.toLowerCase().includes('am');
    const timeOnly = timePart.replace(/am|pm/i, '').trim();
    const timeParts = timeOnly.split(':');

    if (timeParts.length === 2) {
      let hours = parseInt(timeParts[0], 10);
      const mins = parseInt(timeParts[1], 10);
      if (!isNaN(hours) && !isNaN(mins)) {
        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;
        d.setHours(hours, mins);
      }
    }
  }

  if (isNaN(d.getTime())) {
    return { newDateObj, isoString: new Date().toISOString() };
  }
  return { newDateObj, isoString: d.toISOString() };
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
          sentiment: detectSentiment(title),
          impact: calculateImpact(title),
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
      const aiPipeline = await PipelineSingleton.getInstance();

      for (const item of newArticles) {
        console.log(`[NewsBot] Categorizing: "${item.headline.substring(0, 50)}..."`);
        const result = await aiPipeline(item.headline, candidateLabels, {
          multi_label: true,
          hypothesis_template: "This news article is about {}."
        });

        const topLabel = result.labels[0];
        const topScore = result.scores[0];

        item.category = topScore > 0.45 ? topLabel : 'markets';

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
