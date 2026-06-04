'use client';

import { useState, useMemo, useEffect } from 'react';
import RangeDropdown, { RangeOption } from '@/components/filters/RangeDropdown';
import { TrendingUp } from 'lucide-react';
import { TrendFilter, TickerAnalysis } from '@/lib/types';
import { mockMarketTrends } from '@/lib/mock-data';
import {
  TopStocksRow,
  TrendFilterTabs,
  TrendDataTable,
} from '@/components/market-trends';

type TimeRange = '24H' | '7D';

const rangeOptions: RangeOption<TimeRange>[] = [
  { value: '24H', label: 'Last 24H' },
  { value: '7D', label: 'Last 7D' },
];

function filterTrends(
  items: TickerAnalysis[],
  filter: TrendFilter
): TickerAnalysis[] {
  let filtered: TickerAnalysis[];
  switch (filter) {
    case 'top_positive':
      filtered = items.filter((i) => i.sentiment === 'up');
      filtered.sort((a, b) => b.score - a.score);
      break;
    case 'top_negative':
      filtered = items.filter((i) => i.sentiment === 'down');
      filtered.sort((a, b) => a.score - b.score);
      break;
    case 'most_mention':
      filtered = [...items];
      filtered.sort((a, b) => b.mentionCount - a.mentionCount);
      break;
    default:
      filtered = [...items];
      filtered.sort((a, b) => b.score - a.score);
  }
  return filtered;
}

export default function MarketTrendsPage() {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('24H');
  const [activeFilter, setActiveFilter] = useState<TrendFilter>('all');
  const [finvizTrends, setFinvizTrends] = useState<TickerAnalysis[]>([]);

  useEffect(() => {
    fetch('/api/finviz?action=market')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const { gainers, losers } = data.data;
          const mappedGainers: TickerAnalysis[] = gainers.map((g: any, i: number) => ({
            symbol: g.symbol,
            name: `Vol: ${g.volume} | Last: ${g.last}`,
            impactLevel: 'high',
            sentiment: 'up',
            mentionCount: 100 - i,
            sentimentHistorical: { positive: 80, negative: 10, neutral: 10 },
            score: parseFloat(g.change.replace('%', '')) || 50,
          }));
          const mappedLosers: TickerAnalysis[] = losers.map((l: any, i: number) => ({
            symbol: l.symbol,
            name: `Vol: ${l.volume} | Last: ${l.last}`,
            impactLevel: 'high',
            sentiment: 'down',
            mentionCount: 100 - i,
            sentimentHistorical: { positive: 10, negative: 80, neutral: 10 },
            score: parseFloat(l.change.replace('%', '')) || -50,
          }));
          setFinvizTrends([...mappedGainers, ...mappedLosers]);
        }
      })
      .catch(console.error);
  }, []);

  const combinedTrends = useMemo(() => {
    return [...finvizTrends, ...mockMarketTrends];
  }, [finvizTrends]);

  const filteredTrends = useMemo(() => {
    return filterTrends(combinedTrends, activeFilter);
  }, [activeFilter, combinedTrends]);

  // Top 4 cards: "All" shows most extreme scores (furthest from 0), others follow filter
  const sortedTopStocks = useMemo(() => {
    if (activeFilter === 'all') {
      return [...combinedTrends]
        .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
        .slice(0, 4);
    }
    return filteredTrends.slice(0, 4);
  }, [activeFilter, filteredTrends]);

  return (
    <>
      {/* Center content area */}
      <div className="flex-1 overflow-y-auto pb-28 lg:pb-0">
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-white" />
            <h1 className="text-lg font-extrabold text-white uppercase tracking-wide">
              TRENDING
            </h1>
          </div>

          <RangeDropdown
            options={rangeOptions}
            value={selectedRange}
            onChange={setSelectedRange}
          />
        </div>

        {/* Content */}
        <div className="pl-6 pr-8 pb-6 pt-0 flex flex-col gap-4">
          {/* Top Stock Cards */}
          <TopStocksRow items={sortedTopStocks} />
        </div>

        {/* Filter Tabs - outside content padding */}
        <div className="px-4 md:px-6 pb-4">
          <TrendFilterTabs
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        </div>

        {/* Data Table */}
        <div className="px-6 pb-6">
          <TrendDataTable key={activeFilter} items={filteredTrends} />
        </div>
      </div>
    </>
  );
}
