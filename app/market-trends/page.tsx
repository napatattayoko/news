'use client';

import { useState, useMemo, useEffect } from 'react';
import RangeDropdown, { RangeOption } from '@/components/filters/RangeDropdown';
import { TrendingUp, ChevronDown } from 'lucide-react';
import { TrendFilter, TickerAnalysis } from '@/lib/types';
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

export default function MarketTrendsPage() {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('24H');
  const [activeFilter, setActiveFilter] = useState<TrendFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'highest_score' | 'lowest_score' | 'highest_mention'>('highest_score');
  const [finvizTrends, setFinvizTrends] = useState<TickerAnalysis[]>([]);

  useEffect(() => {
    fetch('/api/finviz?action=trending')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setFinvizTrends(data.data);
        }
      })
      .catch(console.error);
  }, []);

  const combinedTrends = useMemo(() => {
    return finvizTrends;
  }, [finvizTrends]);

  const filteredTrends = useMemo(() => {
    let items = [...combinedTrends];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.symbol.toLowerCase().includes(q) || 
        item.name.toLowerCase().includes(q)
      );
    }

    // Category/Trend filter
    if (activeFilter === 'top_positive') {
      items = items.filter((i) => i.sentiment === 'up');
    } else if (activeFilter === 'top_negative') {
      items = items.filter((i) => i.sentiment === 'down');
    }

    // Sort order
    if (sortBy === 'highest_score') {
      items.sort((a, b) => b.score - a.score);
    } else if (sortBy === 'lowest_score') {
      items.sort((a, b) => a.score - b.score);
    } else if (sortBy === 'highest_mention') {
      items.sort((a, b) => b.mentionCount - a.mentionCount);
    }

    return items;
  }, [activeFilter, combinedTrends, searchQuery, sortBy]);

  const topStocks = useMemo(() => {
    const majorSymbols = ['NVDA', 'AAPL', 'TSLA', 'AMZN'];
    const companyNames: Record<string, string> = {
      'NVDA': 'NVIDIA Corporation',
      'AAPL': 'Apple Inc.',
      'TSLA': 'Tesla, Inc.',
      'AMZN': 'Amazon.com, Inc.'
    };
    return majorSymbols.map(sym => {
      const found = combinedTrends.find(item => item.symbol.toUpperCase() === sym);
      if (found) {
        return {
          ...found,
          name: companyNames[sym] || found.name
        };
      }
      return {
        symbol: sym,
        name: companyNames[sym] || sym,
        impactLevel: 'medium' as const,
        sentiment: 'flat' as const,
        mentionCount: 0,
        sentimentHistorical: { positive: 0, negative: 0, neutral: 0 },
        score: 0
      };
    });
  }, [combinedTrends]);

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
          <TopStocksRow items={topStocks} />
        </div>

        {/* Filter Tabs, Search & Sort */}
        <div className="px-6 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <TrendFilterTabs
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />

          <div className="flex items-center gap-3">
            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[180px] bg-[#0a1017] border border-[#222F44] focus:border-[#0D7FF2] text-white text-sm px-3 py-2 rounded-md outline-none transition-colors placeholder:text-slate-500"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-[#0a1017] border border-[#222F44] text-white text-sm px-3 py-2 rounded-md outline-none cursor-pointer focus:border-[#0D7FF2] appearance-none pr-8 font-semibold min-w-[140px]"
              >
                <option value="highest_score">Highest Score</option>
                <option value="lowest_score">Lowest Score</option>
                <option value="highest_mention">Highest Mention</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="px-6 pb-6">
          <TrendDataTable key={`${activeFilter}-${sortBy}-${searchQuery}`} items={filteredTrends} />
        </div>
      </div>
    </>
  );
}
