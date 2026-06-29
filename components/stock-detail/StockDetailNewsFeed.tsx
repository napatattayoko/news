'use client';

import { Fragment, useState, useEffect } from 'react';
import { NewsItem } from '@/lib/types';
import { useTerminalStore } from '@/lib/store';
import NewsCard from '@/components/news/NewsCard';
import NewsCardSkeleton from '@/components/news/NewsCardSkeleton';
import MobileSentimentToggle from '@/components/news/MobileSentimentToggle';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface StockDetailNewsFeedProps {
  symbol: string;
  isLoading?: boolean;
}

export default function StockDetailNewsFeed({ symbol, isLoading: externalIsLoading = false }: StockDetailNewsFeedProps) {
  const { news } = useTerminalStore();
  const mobileSentiment = useTerminalStore((s) => s.mobileSentiment);
  
  // Dynamically derive news for this symbol from the global store
  const localNews = news.filter(n => n.tickers?.some((t: any) => (typeof t === 'string' ? t : t.symbol) === symbol));

  const badItems = localNews.filter((n) => n.sentiment === 'bad' || n.sentiment === 'neutral');
  const goodItems = localNews.filter((n) => n.sentiment === 'good');
  const maxRows = Math.max(badItems.length, goodItems.length);

  const mobileItems = mobileSentiment === 'bad' ? badItems : goodItems;

  const isLoading = externalIsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {/* Mobile skeleton */}
        <div className="md:hidden space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>

        {/* Desktop skeleton - two columns */}
        <div className="hidden md:grid grid-cols-2 gap-x-5 gap-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile: toggle */}
      <div className="md:hidden">
        <div className="py-1">
          <MobileSentimentToggle />
        </div>
        <div className="space-y-3 mt-3">
          {mobileItems.length > 0 ? (
            mobileItems.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))
          ) : (
            <div className="text-center py-12 text-slate-600 text-sm">
              No {mobileSentiment} sentiment news
            </div>
          )}
        </div>
      </div>

      {/* Desktop: two-column grid */}
      <div className="hidden md:grid grid-cols-2 gap-x-5 gap-y-3">
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

        {/* Paired Cards */}
        {Array.from({ length: maxRows }).map((_, i) => (
          <Fragment key={i}>
            {badItems[i] ? <NewsCard item={badItems[i]} /> : <div />}
            {goodItems[i] ? <NewsCard item={goodItems[i]} /> : <div />}
          </Fragment>
        ))}

        {/* Empty state */}
        {maxRows === 0 && (
          <>
            <div className="text-center py-12 text-slate-600 text-sm">No bad sentiment news</div>
            <div className="text-center py-12 text-slate-600 text-sm">No good sentiment news</div>
          </>
        )}
      </div>
    </div>
  );
}
