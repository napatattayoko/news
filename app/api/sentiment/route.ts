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

      // If no news found in DB, return default empty stats (no fallback to mock data)
      if (relatedNews.length === 0) {
        return {
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

      let positive = 0;
      let negative = 0;
      let neutral = 0;

      for (const item of relatedNews) {
        const parsedSentiment = (item.sentiment === 'bullish' || item.sentiment === 'good') ? 'good' : (item.sentiment === 'bearish' || item.sentiment === 'bad') ? 'bad' : 'neutral';
        if (parsedSentiment === 'good') positive++;
        else if (parsedSentiment === 'bad') negative++;
        else neutral++;
      }

      const total = positive + negative + neutral;
      const score = total > 0 ? Math.round(((positive - negative) / total) * 100) : 0;

      return {
        symbol,
        impactLevel,
        sentiment,
        mentionCount: relatedNews.length,
        score,
        sentimentHistorical: { positive, negative, neutral }
      };
    }));

    return NextResponse.json({ success: true, data: results });

  } catch (error: any) {
    console.error('[Sentiment API] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
