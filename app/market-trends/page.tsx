'use client';

import { TrendingUp } from 'lucide-react';
import { TradingViewAdvancedChart } from '@/components/market-trends';

export default function MarketTrendsPage() {
  return (
    <div className="flex-1 p-6 flex flex-col gap-5 h-[calc(100vh-64px)] overflow-hidden">
      {/* Page Header */}
      <div className="flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <TrendingUp size={22} className="text-[#0D7FF2]" />
          <h1 className="text-lg font-extrabold text-white uppercase tracking-wide">
            Trending Overview
          </h1>
        </div>
      </div>

      {/* TradingView Advanced Chart Widget - Full Page View */}
      <div className="flex-1 w-full min-h-0">
        <TradingViewAdvancedChart
          symbol="NASDAQ:AAPL"
          theme="dark"
          height="100%"
        />
      </div>
    </div>
  );
}
