'use client';

import { useParams } from 'next/navigation';
import RangeDropdown, { RangeOption } from '@/components/filters/RangeDropdown';
import { SentimentDonutChart, SentimentScoreCard, StockDetailNewsFeed } from '@/components/stock-detail';
import { mockStockSentiment, mockAIOutlook } from '@/lib/api';
import { useTickerStats } from '@/hooks/useTickersStats';
import { useTerminalStore } from '@/lib/store';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { useState } from 'react';

type TimeRange = '24H' | '7D' | '30D' | 'All';

const rangeOptions: RangeOption<TimeRange>[] = [
  { value: '24H', label: 'Last 24H' },
  { value: '7D', label: 'Last 7D' },
  { value: '30D', label: 'Last 30D' },
  { value: 'All', label: 'All' },
];

export default function StockDetailPage() {
  const params = useParams();
  const symbol = (params.symbol as string)?.toUpperCase() ?? '';
  const [selectedRange, setSelectedRange] = useState<TimeRange>('24H');

  const { news } = useTerminalStore();

  const row = useTickerStats(symbol);
  const aiOutlook = mockAIOutlook[symbol] ?? 'No AI analysis available for this ticker.';

  if (!row) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 text-sm">No sentiment data found for <span className="text-[#0D7FF2] font-bold">${symbol}</span></p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto pb-28 lg:pb-0">
        <div className="px-6 py-5 flex items-center justify-between">
          <h1 className="text-lg font-extrabold text-white uppercase tracking-wide">
            <span className="text-white">${symbol}</span>
          </h1>
          <RangeDropdown
            options={rangeOptions}
            value={selectedRange}
            onChange={setSelectedRange}
          />
        </div>

        <div className="pl-6 pr-8 pb-6 pt-0 flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
            <SentimentDonutChart
              historical={row.sentimentHistorical}
              mentionCount={row.mentionCount}
            />
            <SentimentScoreCard
              sentiment={row.sentiment}
              score={row.score}
              aiOutlook={aiOutlook}
            />
          </div>
          <StockDetailNewsFeed symbol={symbol} />
        </div>
      </div>
    </TooltipProvider>
  );
}
