'use client';

import { useMemo, useEffect, useState } from 'react';
import { TickerAnalysis } from '@/lib/types';
import { Star } from 'lucide-react';
import StockCard from '@/components/market-trends/TopStockCard';

interface WatchlistStocksRowProps {
  trackedSymbols: string[];
  onRemove: (symbol: string) => void;
  isLoading?: boolean;
}

function StockCardSkeleton() {
  return (
    <div className="bg-[#0a1017] border border-[#222F44] rounded-xl p-4 flex flex-col gap-3 h-full animate-pulse">
      {/* Header: Symbol + Trend Icon */}
      <div className="flex items-start justify-between">
        <div>
          <div className="h-4 w-16 bg-slate-700/50 rounded mb-1" />
          <div className="h-8 w-24 bg-slate-700/30 rounded" /> {/* min-h-[32px] for name */}
        </div>
        <div className="w-8 h-8 bg-slate-700/30 rounded-full shrink-0" />
      </div>

      {/* Sentiment Score Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 bg-slate-700/40 rounded" />
          <div className="h-4 w-8 bg-slate-700/40 rounded" />
        </div>
        {/* Progress bar */}
        <div className="h-2 w-full bg-[#2A2A2A] rounded-full" />
      </div>

      {/* Sentiment Badge */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-slate-700/40 rounded-full" />
        <div className="h-3 w-16 bg-slate-700/30 rounded" />
      </div>
    </div>
  );
}

export default function WatchlistStocksRow({ trackedSymbols, onRemove }: WatchlistStocksRowProps) {
  const [trackedStocks, setTrackedStocks] = useState<TickerAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const fetchAll = async () => {
      try {
        const results = await Promise.all(
          trackedSymbols.map(async (symbol) => {
            try {
              const res = await fetch(`/api/finviz?action=quote&symbol=${symbol}`);
              const data = await res.json();
              if (data.success && data.data && data.data.quote) {
                const changeStr = data.data.quote['Change'];
                const change = parseFloat(changeStr) || 0;
                return {
                  symbol,
                  name: symbol,
                  sentiment: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
                  impactLevel: Math.abs(change) > 2 ? 'high' : Math.abs(change) > 0.5 ? 'medium' : 'low',
                  score: change
                } as TickerAnalysis;
              }
            } catch (e) {}
            return { symbol, name: symbol, sentiment: 'flat', impactLevel: 'medium', score: 0 } as any;
          })
        );
        if (isMounted) setTrackedStocks(results);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    if (trackedSymbols.length > 0) {
      fetchAll();
    } else {
      setTrackedStocks([]);
      setIsLoading(false);
    }

    return () => { isMounted = false; };
  }, [trackedSymbols]);

  if (isLoading) {
    return (
      <>
        {/* Mobile: Horizontal scroll skeleton */}
        <div className="flex gap-4 overflow-x-auto pb-2 sm:hidden snap-x snap-mandatory scrollbar-hide">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[280px] snap-start">
              <StockCardSkeleton />
            </div>
          ))}
        </div>

        {/* Desktop: Grid skeleton */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StockCardSkeleton key={i} />
          ))}
        </div>
      </>
    );
  }

  if (trackedStocks.length === 0) {
    return (
      <div className="bg-[#1A1A1A] border border-[#222F44] border-dashed rounded-xl p-10 text-center">
        <Star size={28} className="text-slate-700 mx-auto mb-3" />
        <p className="text-sm text-slate-600 font-medium">Your watchlist is empty</p>
        <p className="text-xs text-slate-700 mt-1">
          Click + ADD to add tickers to your watchlist
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto pt-2 pb-2 pr-2 sm:hidden snap-x snap-mandatory scrollbar-hide">
        {trackedStocks.map((item) => (
          <div key={item.symbol} className="flex-shrink-0 w-[280px] snap-start">
            <StockCard item={item} onRemove={onRemove} />
          </div>
        ))}
      </div>

      {/* Desktop: Grid layout */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {trackedStocks.map((item) => (
          <StockCard key={item.symbol} item={item} onRemove={onRemove} />
        ))}
      </div>
    </>
  );
}
