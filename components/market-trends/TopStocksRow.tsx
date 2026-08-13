'use client';

import { TickerAnalysis } from '@/lib/types';
import TopStockCard from './TopStockCard';
import { cn } from '@/lib/utils';

interface TopStocksRowProps {
  items: TickerAnalysis[];
}

export default function TopStocksRow({ items }: TopStocksRowProps) {
  if (items.length === 0) return null;

  return (
    <>
      {/* Mobile: Horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto pb-2 sm:hidden snap-x snap-mandatory scrollbar-hide">
        {items.map((item, index) => (
          <div
            key={item.symbol}
            className={cn(
              'flex-shrink-0 w-[280px] snap-start',
              index === items.length - 1 && 'mr-0'
            )}
          >
            <TopStockCard item={item} />
          </div>
        ))}
      </div>

      {/* Desktop: Grid layout */}
      <div className={cn(
        "hidden sm:grid sm:grid-cols-2 gap-4",
        items.length === 1 && "md:grid-cols-1 max-w-[280px]",
        items.length === 2 && "md:grid-cols-2 max-w-[580px]",
        items.length === 3 && "md:grid-cols-3 max-w-[880px]",
        items.length === 4 && "md:grid-cols-4",
        items.length === 5 && "md:grid-cols-5",
        items.length === 6 && "md:grid-cols-6",
        items.length >= 7 && "md:grid-cols-4 xl:grid-cols-7"
      )}>
        {items.map((item) => (
          <TopStockCard key={item.symbol} item={item} />
        ))}
      </div>
    </>
  );
}
