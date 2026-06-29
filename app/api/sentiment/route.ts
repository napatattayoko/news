import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mockStockSentiment } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    if (!symbolsParam) {
      return NextResponse.json({ success: false, error: 'Symbols required' }, { status: 400 });
    }

    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    
    // We will query the DB for each symbol.
    // For small arrays of symbols (e.g. 10-20), Promise.all is perfectly fine and fast.
    const results = await Promise.all(symbols.map(async (symbol) => {
      // Find all news that contains the symbol in the JSON string
      const relatedNews = await prisma.news.findMany({
        where: {
          tickers: {
            contains: `"${symbol}"`
          }
        },
        orderBy: { publishedAt: 'desc' },
        select: {
          impact: true,
          sentiment: true
        }
      });

      // If no news found in DB, fallback to mock data
      if (relatedNews.length === 0) {
        const mock = mockStockSentiment.find(m => m.symbol === symbol);
        return mock || {
          symbol,
          impactLevel: 'low',
          sentiment: 'flat',
          mentionCount: 0,
          score: 5,
          sentimentHistorical: { positive: 0, negative: 0, neutral: 0 }
        };
      }

      // Just pull the impact and sentiment directly from the latest news article!
      // No new aggregation logic needed since the AI already calculated this for us.
      const latestNews = relatedNews[0];
      const impactLevel = latestNews.impact;
      const sentiment = latestNews.sentiment === 'good' || latestNews.sentiment === 'bullish' ? 'up' : 
                        latestNews.sentiment === 'bad' || latestNews.sentiment === 'bearish' ? 'down' : 'flat';

      // Mock Score & Historical (since we don't have real logic for them yet)
      const mock = mockStockSentiment.find(m => m.symbol === symbol);

      return {
        symbol,
        impactLevel,
        sentiment,
        mentionCount: relatedNews.length,
        score: mock?.score ?? 5,
        sentimentHistorical: mock?.sentimentHistorical ?? { positive: 0, negative: 0, neutral: 0 }
      };
    }));

    return NextResponse.json({ success: true, data: results });

  } catch (error: any) {
    console.error('[Sentiment API] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
