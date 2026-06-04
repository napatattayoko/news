'use client';

import { Fragment, useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { mockNews } from '@/lib/api';
import { useTerminalStore } from '@/lib/store';
import { usePageLayout } from '@/hooks/usePageLayout';
import NewsCard from '@/components/news/NewsCard';
import { TelegramStatusWidget } from '@/components/watchlist';
import { mockTelegramNotifications } from '@/lib/api';
import MobileSentimentToggle from '@/components/news/MobileSentimentToggle';
import RangeDropdown, { RangeOption as RangeDropdownOption } from '@/components/filters/RangeDropdown';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import PremiumLock from '@/components/premium/PremiumLock';

type TimeRange = '24h' | '7d';

const RANGE_MS: Record<TimeRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

const rangeOptions: RangeDropdownOption<TimeRange>[] = [
  { value: '24h', label: 'Last 24H' },
  { value: '7d', label: 'Last 7D' },
];

const trendConfig = {
  up: { icon: TrendingUp, bg: 'bg-[#17382D]', color: 'text-[#10B981]' },
  down: { icon: TrendingDown, bg: 'bg-[#592424]', color: 'text-[#EF4444]' },
  flat: { icon: Minus, bg: 'bg-[#262626]', color: 'text-[#808080]' },
};

export default function TickerDetailPage() {
  const params = useParams();
  const symbol = (params.symbol as string).toUpperCase();
  const [range, setRange] = useState<TimeRange>('24h');
  const selectedSymbols = useTerminalStore((s) => s.selectedSymbols);
  const userPlan = useTerminalStore((s) => s.userPlan);
  const mobileSentiment = useTerminalStore((s) => s.mobileSentiment);

  const [finvizData, setFinvizData] = useState<{ quote: Record<string, string>, news: any[] } | null>(null);

  useEffect(() => {
    fetch(`/api/finviz?action=quote&symbol=${symbol}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setFinvizData(data.data);
        }
      })
      .catch(console.error);
  }, [symbol]);

  // Memoize custom sidebar to prevent recreation on every render
  const customSidebar = useMemo(
    () => (
      <aside className="hidden xl:flex w-80 shrink-0 border-l border-[#222F44] overflow-y-auto p-4 flex-col gap-4 bg-[#0a1017]">
        <TelegramStatusWidget
          trackedSymbols={[symbol]}
          notifications={mockTelegramNotifications}
        />
      </aside>
    ),
    [symbol]
  );

  // Custom sidebar for ticker detail
  usePageLayout({
    useDefaultSidebar: false,
    rightSidebar: customSidebar,
  });

  // Find ticker name from news data
  const tickerName = useMemo(() => {
    for (const news of mockNews) {
      const t = news.tickers.find((t) => t.symbol === symbol);
      if (t) return t.name;
    }
    return symbol;
  }, [symbol]);

  // Compute avg score and trend
  const trend = useMemo(() => {
    const scores: number[] = [];
    for (const news of mockNews) {
      for (const t of news.tickers) {
        if (t.symbol === symbol) scores.push(t.sentimentScore);
      }
    }
    if (scores.length === 0) return 'flat' as const;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return (avg > 0 ? 'up' : avg < 0 ? 'down' : 'flat') as 'up' | 'down' | 'flat';
  }, [symbol]);

  const filtered = useMemo(() => {
    const now = new Date();
    let items = mockNews.filter((n) =>
      n.tickers.some((t) => t.symbol === symbol)
    );

    // Filter by range
    const cutoff = new Date(now.getTime() - RANGE_MS[range]);
    items = items.filter((n) => new Date(n.publishedAt) >= cutoff);

    // Filter by selected symbols
    if (selectedSymbols.length > 0) {
      items = items.filter((n) =>
        n.tickers.some((t) => selectedSymbols.includes(t.symbol))
      );
    }

    // Sort latest first
    items = [...items].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Mix Finviz stock-specific news if available
    if (finvizData?.news) {
      const fvNews = finvizData.news.map((n: any, i: number) => ({
        id: `fv-${i}`,
        headline: n.title,
        body: `Time: ${n.time} | Finviz News`,
        sources: [{ name: n.source, url: n.url }],
        publishedAt: new Date().toISOString(),
        regionTag: 'us',
        countryCode: 'us',
        category: 'markets',
        impact: 'medium',
        sentiment: 'neutral',
        tickers: [{ symbol, name: symbol, sentiment: 'flat', sentimentScore: 0 }],
      }));
      items = [...fvNews, ...items];
    }

    return items;
  }, [symbol, range, selectedSymbols, finvizData]);

  if (userPlan === 'free') {
    return (
      <PremiumLock featureName="Ticker Detail" />
    );
  }

  const badItems = filtered.filter((n) => n.sentiment === 'bad' || n.sentiment === 'neutral');
  const goodItems = filtered.filter((n) => n.sentiment === 'good');
  const maxRows = Math.max(badItems.length, goodItems.length);

  const TrendIcon = trendConfig[trend].icon;

  return (
    <>
      <div className="flex-1 overflow-y-auto pb-28 lg:pb-0">
          {/* Ticker Header */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold text-white">${symbol}</h1>
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', trendConfig[trend].bg)}>
                  <TrendIcon size={16} className={trendConfig[trend].color} />
                </div>
              </div>

              <RangeDropdown
                options={rangeOptions}
                value={range}
                onChange={setRange}
              />
            </div>
            <p className="text-[#808080] text-sm mt-1">{tickerName}</p>
          </div>

          {finvizData && finvizData.quote && (
            <div className="px-6 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border border-[#222F44] bg-[#111722]">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500">Market Cap</span>
                  <span className="text-sm font-semibold text-white">{finvizData.quote['Market Cap'] || '-'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500">P/E</span>
                  <span className="text-sm font-semibold text-white">{finvizData.quote['P/E'] || '-'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500">Volume</span>
                  <span className="text-sm font-semibold text-white">{finvizData.quote['Volume'] || '-'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500">Target Price</span>
                  <span className="text-sm font-semibold text-white">{finvizData.quote['Target Price'] || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* News Feed — Mobile */}
          <div className="md:hidden px-4 pb-6">
            <div className="py-3">
              <MobileSentimentToggle />
            </div>
                <div className="space-y-3">
                  {(mobileSentiment === 'bad' ? badItems : goodItems).length > 0 ? (
                    (mobileSentiment === 'bad' ? badItems : goodItems).map((item) => (
                      <NewsCard key={item.id} item={item} />
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-600 text-sm">
                      No {mobileSentiment} sentiment news
                    </div>
                  )}
                </div>
              </div>

              {/* News Feed — Desktop */}
              <div className="hidden md:block px-6 pb-6">
                <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                  {/* Column Headers */}
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown size={18} className="text-red-400" />
                    <h2 className="text-base font-bold tracking-widest uppercase text-red-400">Bad Sentiment</h2>
                    <span className="ml-auto text-xs text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">
                      {badItems.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={18} className="text-green-400" />
                    <h2 className="text-base font-bold tracking-widest uppercase text-green-400">Good Sentiment</h2>
                    <span className="ml-auto text-xs text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">
                      {goodItems.length}
                    </span>
                  </div>

                  {Array.from({ length: maxRows }).map((_, i) => (
                    <Fragment key={i}>
                      {badItems[i] ? <NewsCard item={badItems[i]} /> : <div />}
                      {goodItems[i] ? <NewsCard item={goodItems[i]} /> : <div />}
                    </Fragment>
                  ))}

                  {maxRows === 0 && (
                    <>
                      <div className="text-center py-12 text-slate-600 text-sm">No bad sentiment news</div>
                      <div className="text-center py-12 text-slate-600 text-sm">No good sentiment news</div>
                    </>
                  )}
                </div>
              </div>
      </div>
    </>
  );
}
