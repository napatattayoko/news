import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

async function fetchNews() {
  const response = await fetch('https://finviz.com/news', { headers: HEADERS, next: { revalidate: 600 } });
  if (!response.ok) throw new Error('Failed to fetch news');
  const html = await response.text();
  const $ = cheerio.load(html);
  const news: any[] = [];
  $('table.styled-table-new tr').each((i, row) => {
    const time = $(row).find('td:first-child').text().trim();
    const linkEl = $(row).find('a.nn-tab-link');
    const title = linkEl.text().trim();
    const url = linkEl.attr('href');
    if (title && url) {
      news.push({ id: `fv-news-${i}`, time, title, url, source: 'Finviz' });
    }
  });
  return news.slice(0, 60);
}

async function fetchMarket() {
  const response = await fetch('https://finviz.com/', { headers: HEADERS, next: { revalidate: 600 } });
  if (!response.ok) throw new Error('Failed to fetch market data');
  const html = await response.text();
  const $ = cheerio.load(html);
  const gainers: any[] = [];
  const losers: any[] = [];

  // Extract gainers
  $('table.styled-table-new').eq(0).find('tr').each((i, row) => {
    if (i === 0) return; // skip header
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

  // Extract losers
  $('table.styled-table-new').eq(1).find('tr').each((i, row) => {
    if (i === 0) return; // skip header
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

async function fetchQuote(symbol: string) {
  const response = await fetch(`https://finviz.com/quote.ashx?t=${symbol}`, { headers: HEADERS, next: { revalidate: 600 } });
  if (!response.ok) throw new Error('Failed to fetch quote');
  const html = await response.text();
  const $ = cheerio.load(html);

  const quoteData: Record<string, string> = {};
  $('.snapshot-table2 tr').each((i, row) => {
    const cols = $(row).find('td');
    for (let j = 0; j < cols.length; j += 2) {
      const key = $(cols[j]).text().trim();
      const val = $(cols[j + 1]).text().trim();
      if (key) quoteData[key] = val;
    }
  });

  // Also fetch news for this specific stock
  const stockNews: any[] = [];
  $('#news-table tr').each((i, row) => {
    const time = $(row).find('td').first().text().trim();
    const a = $(row).find('a.tab-link-news');
    const title = a.text().trim();
    const url = a.attr('href');
    if (title) {
      stockNews.push({ time, title, url, source: 'Finviz' });
    }
  });

  return { quote: quoteData, news: stockNews.slice(0, 10) };
}

export async function GET(request: Request) {
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
