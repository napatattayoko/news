import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAIOutlook } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.trim().toUpperCase();

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
    }

    // 1. Fetch current price change from Yahoo Finance
    const yfRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`
    );
    let priceChange = 0;
    if (yfRes.ok) {
      const yfData = await yfRes.json();
      const chartResult = yfData?.chart?.result?.[0];
      if (chartResult && chartResult.timestamp) {
        const quotes = chartResult.indicators.quote[0];
        const open = quotes.open[0];
        const close = quotes.close[0];
        if (open !== null && close !== null && open !== undefined && close !== undefined) {
          priceChange = ((close - open) / open) * 100;
        }
      }
    }

    // 2. Query latest news from database for this ticker
    const recentNews = await prisma.news.findMany({
      where: {
        tickers: {
          contains: `"${symbol}"`,
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: {
        headline: true,
      },
    });

    const headlines = recentNews.map((n) => n.headline);

    // 3. Call HF Llama-3 AI Outlook generator
    const outlook = await generateAIOutlook(symbol, priceChange, headlines);

    return NextResponse.json({ success: true, outlook });
  } catch (error: any) {
    console.error('[AI Outlook API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
