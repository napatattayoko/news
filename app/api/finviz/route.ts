import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Category, NewsItem } from '@/lib/types';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ─── Scrape Functions (Restored) ──────────────────────

async function fetchMarket() {
  const response = await fetch('https://finviz.com/', { headers: HEADERS, next: { revalidate: 600 } });
  if (!response.ok) throw new Error('Failed to fetch market data');
  const html = await response.text();
  const $ = cheerio.load(html);
  const gainers: any[] = [];
  const losers: any[] = [];

  $('table.styled-table-new').eq(0).find('tr').each((i, row) => {
    if (i === 0) return;
    const cols = $(row).find('td');
    if (cols.length >= 6) {
      gainers.push({ symbol: $(cols[0]).text().trim(), last: $(cols[1]).text().trim(), change: $(cols[2]).text().trim(), volume: $(cols[3]).text().trim() });
    }
  });

  $('table.styled-table-new').eq(1).find('tr').each((i, row) => {
    if (i === 0) return;
    const cols = $(row).find('td');
    if (cols.length >= 6) {
      losers.push({ symbol: $(cols[0]).text().trim(), last: $(cols[1]).text().trim(), change: $(cols[2]).text().trim(), volume: $(cols[3]).text().trim() });
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

  // Since we only need quote data (news is from DB now or we can skip news for quote), just return empty news for now.
  return { quote: quoteData, news: [] };
}

// ─── Main Route Handler ────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'news';

    if (action === 'market') {
      const data = await fetchMarket();
      return NextResponse.json({ success: true, data });
    }

    if (action === 'quote') {
      const symbol = searchParams.get('symbol');
      if (!symbol) return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
      const data = await fetchQuote(symbol);
      return NextResponse.json({ success: true, data });
    }

    // Default to 'news' action
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;

    const news = await prisma.news.findMany({
      orderBy: { publishedAt: 'desc' },
      take: limit,
      skip: skip,
    });

    const formattedNews = news.map(item => ({
      ...item,
      category: item.category as Category,
      sentiment: (item.sentiment === 'bullish' || item.sentiment === 'good') ? 'good' : (item.sentiment === 'bearish' || item.sentiment === 'bad') ? 'bad' : 'neutral',
      tickers: JSON.parse(item.tickers as string).map((t: any) => 
        typeof t === 'string' 
          ? { symbol: t, name: t, sentiment: 'flat', sentimentScore: 0 } 
          : t
      ),
      sources: JSON.parse(item.sources as string),
      publishedAt: item.publishedAt.toISOString()
    }));

    return NextResponse.json({ success: true, data: formattedNews });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
