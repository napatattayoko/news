'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StockQuote {
  symbol: string;
  last: string;
  change: string;
}

export default function FinvizMarquee() {
  const [stocks, setStocks] = useState<StockQuote[]>([]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchMarketData = async () => {
      try {
        const res = await fetch('/api/finviz?action=market');
        const json = await res.json();
        if (json.success && json.data && isMounted) {
          const { gainers, losers } = json.data;
          // Combine and shuffle or just list them
          const combined = [...gainers, ...losers].map((s: any) => ({
            symbol: s.symbol,
            last: s.last,
            change: s.change,
          }));
          setStocks(combined);
        }
      } catch (err) {
        console.error('Failed to fetch finviz marquee data:', err);
      }
    };

    fetchMarketData();
    // Auto refresh every 10 minutes (Real-time polling)
    const interval = setInterval(fetchMarketData, 600000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (stocks.length === 0) return null;

  return (
    <div className="w-full min-w-0 bg-[#0a1017] border-b border-[#222F44] overflow-hidden flex items-center h-8 relative">
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0a1017] to-transparent z-10"></div>
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0a1017] to-transparent z-10"></div>
      
      <div className="flex animate-marquee whitespace-nowrap">
        {/* Double the array for seamless infinite scroll */}
        {[...stocks, ...stocks].map((stock, i) => {
          const isPositive = !stock.change.startsWith('-');
          return (
            <div key={`${stock.symbol}-${i}`} className="flex items-center gap-2 mx-4 text-xs font-semibold">
              <span className="text-white">{stock.symbol}</span>
              <span className="text-slate-400">{stock.last}</span>
              <span className={cn("flex items-center gap-0.5", isPositive ? "text-green-500" : "text-red-500")}>
                {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {stock.change}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
