'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import RangeDropdown, { RangeOption } from '@/components/filters/RangeDropdown';
import { SentimentHistoricalBar, TopStocksRow } from '@/components/market-trends';
import { cn } from '@/lib/utils';
import { impactConfigCompact } from '@/lib/constants';
import { Rss, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronLeft, ChevronRight, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { ImpactLevel, TrendFilter } from '@/lib/types';
import SentimentFilterRibbon from '@/components/filters/SentimentFilterRibbon';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import { usePagination } from '@/hooks/usePagination';
import { useTickersStats } from '@/hooks/useTickersStats';

type TimeRange = '24H' | '7D';

const rangeOptions: RangeOption<TimeRange>[] = [
  { value: '24H', label: 'Last 24H' },
  { value: '7D', label: 'Last 7D' },
];

type SortColumn = 'symbol' | 'impact' | 'sentiment' | 'mention' | 'score' | 'date';
type SortDirection = 'asc' | 'desc';

const impactOrder: Record<ImpactLevel, number> = { high: 3, medium: 2, low: 1 };
const sentimentOrder: Record<'up' | 'down' | 'flat', number> = { up: 3, flat: 2, down: 1 };

const sentimentConfig = {
  up: { label: 'Positive', icon: TrendingUp, textColor: 'text-[#22C55E]', iconColor: 'text-[#10B981]', bg: 'bg-[#17382D]' },
  down: { label: 'Negative', icon: TrendingDown, textColor: 'text-[#EF4444]', iconColor: 'text-[#EF4444]', bg: 'bg-[#2F1E1E]' },
  flat: { label: 'Neutral', icon: Minus, textColor: 'text-[#808080]', iconColor: 'text-[#808080]', bg: 'bg-[#262626]' },
};

function SortIcon({ column, sortColumn, sortDirection }: { column: SortColumn; sortColumn: SortColumn | null; sortDirection: SortDirection }) {
  if (sortColumn !== column) return <ArrowUp size={12} className="text-slate-600" />;
  return sortDirection === 'asc'
    ? <ArrowUp size={12} className="text-[#3B82F6]" />
    : <ArrowDown size={12} className="text-[#3B82F6]" />;
}

export default function StockSentimentPage() {
  const router = useRouter();
  const [rppOpen, setRppOpen] = useState(false);
  const rppRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [selectedRange, setSelectedRange] = useState<TimeRange>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedRange_sentiment') as TimeRange;
      if (saved === '24H' || saved === '7D') return saved;
    }
    return '24H';
  });
  const [activeFilter, setActiveFilter] = useState<TrendFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [impactFilter, setImpactFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleRangeChange = (newRange: TimeRange) => {
    setSelectedRange(newRange);
    localStorage.setItem('selectedRange_sentiment', newRange);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    pagination.setPage(0);
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (rppRef.current && !rppRef.current.contains(e.target as Node)) setRppOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch all tickers stats by passing an empty array
  const { stats: baseRows, isLoading } = useTickersStats([], selectedRange);

  // Map NVDA, AAPL, TSLA, AMZN stats dynamically for top stock cards
  const topStocks = useMemo(() => {
    const majorSymbols = ['NVDA', 'AAPL', 'TSLA', 'AMZN'];
    const companyNames: Record<string, string> = {
      'NVDA': 'NVIDIA Corporation',
      'AAPL': 'Apple Inc.',
      'TSLA': 'Tesla, Inc.',
      'AMZN': 'Amazon.com, Inc.'
    };
    return majorSymbols.map(sym => {
      // Find the latest record for this symbol (since there can be multiple daily rows)
      const symbolRows = baseRows.filter(item => item.symbol.toUpperCase() === sym);
      const found = symbolRows.sort((a, b) => {
        const timeA = a.latestNewsDate ? new Date(a.latestNewsDate).getTime() : 0;
        const timeB = b.latestNewsDate ? new Date(b.latestNewsDate).getTime() : 0;
        return timeB - timeA;
      })[0];

      if (found) {
        return {
          ...found,
          name: companyNames[sym] || found.symbol
        };
      }
      return {
        symbol: sym,
        name: companyNames[sym] || sym,
        impactLevel: 'medium' as const,
        sentiment: 'flat' as const,
        mentionCount: 0,
        sentimentHistorical: { positive: 0, negative: 0, neutral: 0 },
        score: 5
      };
    });
  }, [baseRows]);

  // Apply search query, sentiment filter + sort
  const filteredRows = useMemo(() => {
    let filtered = [...baseRows];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(row => row.symbol.toLowerCase().includes(q));
    }

    // Filter by impact level dropdown
    if (impactFilter !== 'all') {
      filtered = filtered.filter(row => row.impactLevel === impactFilter);
    }

    // Filter by 24H mentions (if range is 24H)
    if (selectedRange === '24H') {
      filtered = filtered.filter((r) => r.mentionCount > 0);
    }

    // Filter by sentiment filter ribbon
    switch (activeFilter) {
      case 'top_positive':
        filtered = filtered.filter((r) => r.sentiment === 'up');
        break;
      case 'top_negative':
        filtered = filtered.filter((r) => r.sentiment === 'down');
        break;
    }

    return filtered;
  }, [baseRows, searchQuery, impactFilter, selectedRange, activeFilter]);

  // Apply sorting
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    if (!sortColumn) {
      // Default order: latest date first → then by mention count → then by absolute score
      return sorted.sort((a, b) => {
        const timeA = a.latestNewsDate ? new Date(a.latestNewsDate).getTime() : 0;
        const timeB = b.latestNewsDate ? new Date(b.latestNewsDate).getTime() : 0;
        return timeB - timeA || b.mentionCount - a.mentionCount || Math.abs(b.score) - Math.abs(a.score);
      });
    }

    return sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'impact':
          comparison = impactOrder[a.impactLevel] - impactOrder[b.impactLevel];
          break;
        case 'sentiment':
          comparison = sentimentOrder[a.sentiment] - sentimentOrder[b.sentiment];
          break;
        case 'mention':
          comparison = a.mentionCount - b.mentionCount;
          break;
        case 'score':
          comparison = a.score - b.score;
          break;
        case 'date':
          const timeA = a.latestNewsDate ? new Date(a.latestNewsDate).getTime() : 0;
          const timeB = b.latestNewsDate ? new Date(b.latestNewsDate).getTime() : 0;
          comparison = timeA - timeB;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  // Pagination hook
  const pagination = usePagination({
    totalItems: sortedRows.length,
    initialRowsPerPage: 10,
  });

  const paged = sortedRows.slice(pagination.startIndex, pagination.endIndex);

  return (
    <>
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rss size={20} className="text-white" />
            <h1 className="text-lg font-extrabold text-white uppercase tracking-wide">
              Stock Sentiment
            </h1>
          </div>
          <RangeDropdown
            options={rangeOptions}
            value={selectedRange}
            onChange={handleRangeChange}
          />
        </div>

        {/* Top Stock Cards */}
        <div className="px-6 pb-4 pt-0">
          <TopStocksRow items={topStocks} />
        </div>

        {/* Sentiment Filter Ribbon & Search / Filter Inputs */}
        <div className="px-6 pt-2 pb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <SentimentFilterRibbon
            activeFilter={activeFilter}
            onFilterChange={(filter) => {
              setActiveFilter(filter);
              setSortColumn(null);
              setSortDirection('asc');
              pagination.setPage(0);
            }}
          />
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {/* Search Box */}
            <div className="relative w-full sm:w-[200px]">
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  pagination.setPage(0);
                }}
                className="w-full bg-[#0a1017] border border-[#222F44] focus:border-[#0D7FF2] text-white text-sm pl-9 pr-4 py-2.5 rounded-lg outline-none transition-colors placeholder:text-slate-500"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>

            {/* Impact Dropdown */}
            <div className="relative w-full sm:w-[140px]">
              <select
                value={impactFilter}
                onChange={(e: any) => {
                  setImpactFilter(e.target.value);
                  pagination.setPage(0);
                }}
                className="w-full bg-[#0a1017] border border-[#222F44] text-white text-sm px-3 py-2.5 rounded-lg outline-none cursor-pointer focus:border-[#0D7FF2] appearance-none pr-8 font-semibold"
              >
                <option value="all">All Impact</option>
                <option value="high">High Impact</option>
                <option value="medium">Medium Impact</option>
                <option value="low">Low Impact</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Content Table */}
        <div className="px-6 pb-6 pt-0 flex flex-col gap-4">
          <div className="border border-[#222F44] rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#222F44]">
                    <th
                      onClick={() => handleSort('symbol')}
                      className="text-left text-xs font-bold text-white uppercase tracking-wider px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1">
                        Ticker <SortIcon column="symbol" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort('impact')}
                      className="text-left text-xs font-bold text-white uppercase tracking-wider px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1">
                        Impact <SortIcon column="impact" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort('sentiment')}
                      className="text-left text-xs font-bold text-white uppercase tracking-wider px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1">
                        Sentiment <SortIcon column="sentiment" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort('mention')}
                      className="text-center text-xs font-bold text-white uppercase tracking-wider px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1 justify-center">
                        Mention <SortIcon column="mention" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </span>
                    </th>
                    <th className="text-left text-xs font-bold text-white uppercase tracking-wider px-4 py-3">Sentiment Historical</th>
                    <th
                      onClick={() => handleSort('score')}
                      className="text-right text-xs font-bold text-white uppercase tracking-wider px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Score <SortIcon column="score" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort('date')}
                      className="text-right text-xs font-bold text-white uppercase tracking-wider px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Date <SortIcon column="date" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="animate-pulse border-b border-[#222F44]/30">
                        <td className="px-4 py-4"><div className="h-4 w-12 bg-slate-700/50 rounded animate-pulse" /></td>
                        <td className="px-4 py-4"><div className="h-6 w-16 bg-slate-700/30 rounded-full" /></td>
                        <td className="px-4 py-4"><div className="h-6 w-20 bg-slate-700/30 rounded-full" /></td>
                        <td className="px-4 py-4 text-center"><div className="h-4 w-6 bg-slate-700/50 rounded mx-auto" /></td>
                        <td className="px-4 py-4"><div className="h-2 w-full bg-slate-700/20 rounded" /></td>
                        <td className="px-4 py-4 text-right"><div className="h-6 w-10 bg-slate-700/30 rounded-full ml-auto" /></td>
                        <td className="px-4 py-4 text-center"><div className="h-4 w-10 bg-slate-700/50 rounded mx-auto" /></td>
                      </tr>
                    ))
                  ) : paged.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                        No results found
                      </td>
                    </tr>
                  ) : paged.map((row) => {
                    const impact = impactConfigCompact[row.impactLevel];
                    const sent = sentimentConfig[row.sentiment];
                    const SentIcon = sent.icon;

                    return (
                      <tr
                        key={row.latestNewsDate ? `${row.symbol}-${row.latestNewsDate}` : row.symbol}
                        onClick={() => router.push(`/stock-sentiment/${row.symbol.toLowerCase()}`)}
                        className="border-b border-[#222F44] hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <span className="text-[#0D7FF2] font-bold text-sm">${row.symbol}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs font-bold px-4 py-1.5 rounded-full', impact.bg, impact.text, impact.border)}>
                            {impact.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold', sent.bg)}>
                            <SentIcon size={14} className={sent.iconColor} />
                            <span className={sent.textColor}>{sent.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-white text-sm font-bold">{row.mentionCount}</span>
                        </td>
                        <td className="px-4 py-3">
                          <SentimentHistoricalBar data={row.sentimentHistorical} height={6} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 rounded-full border border-[#222F44] text-white font-bold text-sm">
                            {row.score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-400 font-bold whitespace-nowrap">
                          {row.latestNewsDate ? (
                            new Date(row.latestNewsDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#222F44]">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">Rows per page:</span>
                <div className="relative" ref={rppRef}>
                  <button
                    onClick={() => setRppOpen(!rppOpen)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#333333] text-white text-sm hover:bg-[#444] transition-colors"
                  >
                    {pagination.rowsPerPage}
                    <ChevronDown size={14} className={cn('transition-transform', rppOpen && 'rotate-180')} />
                  </button>
                  {rppOpen && (
                    <div className="absolute top-full mt-1 left-0 z-50 bg-[#1A1A1A] border border-[#4D4D4D] rounded-lg shadow-xl overflow-hidden">
                      {[10, 50, 100].map((n) => (
                        <button
                          key={n}
                          onClick={() => {
                            pagination.setRowsPerPage(n);
                            setRppOpen(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-400">
                  {pagination.startIndex + 1}-{Math.min(pagination.endIndex, sortedRows.length)} of {sortedRows.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={pagination.prevPage}
                    disabled={!pagination.canGoPrev}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-slate-400"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="flex items-center gap-1">
                    {pagination.pageNumbers.map((pageNum, idx) =>
                      pageNum === 'ellipsis' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">...</span>
                      ) : (
                        <button
                          key={pageNum}
                          onClick={() => pagination.setPage(pageNum - 1)}
                          className={cn(
                            'min-w-[28px] h-7 px-2 rounded text-sm font-medium transition-colors',
                            pagination.currentPage === pageNum - 1
                              ? 'bg-[#0D7FF2] text-white'
                              : 'text-slate-400 hover:bg-white/10'
                          )}
                        >
                          {pageNum}
                        </button>
                      )
                    )}
                  </div>
                  <button
                    onClick={pagination.nextPage}
                    disabled={!pagination.canGoNext}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-slate-400"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ScrollToTopButton scrollContainerRef={scrollRef} />
    </>
  );
}
