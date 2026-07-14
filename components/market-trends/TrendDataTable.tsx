'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TickerAnalysis, ImpactLevel } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import SentimentHistoricalBar from './SentimentHistoricalBar';
import { usePagination } from '@/hooks/usePagination';
import { impactConfigCompact } from '@/lib/constants';

type SortColumn = 'symbol' | 'impact' | 'sentiment' | 'mention' | 'score';
type SortDirection = 'asc' | 'desc';

const impactOrder: Record<ImpactLevel, number> = { high: 3, medium: 2, low: 1 };
const sentimentOrder: Record<'up' | 'down' | 'flat', number> = { up: 3, flat: 2, down: 1 };

const ROWS_PER_PAGE_OPTIONS = [10, 50, 100] as const;

interface TrendDataTableProps {
  items: TickerAnalysis[];
}

const sentimentConfig = {
  up: {
    label: 'Positive',
    icon: TrendingUp,
    textColor: 'text-[#22C55E]',
    iconColor: 'text-[#10B981]',
    bg: 'bg-[#17382D]',
  },
  down: {
    label: 'Negative',
    icon: TrendingDown,
    textColor: 'text-[#EF4444]',
    iconColor: 'text-[#EF4444]',
    bg: 'bg-[#2F1E1E]',
  },
  flat: {
    label: 'Neutral',
    icon: Minus,
    textColor: 'text-[#808080]',
    iconColor: 'text-[#808080]',
    bg: 'bg-[#262626]',
  },
};

function SortIcon({ column, sortColumn, sortDirection }: { column: SortColumn; sortColumn: SortColumn | null; sortDirection: SortDirection }) {
  if (sortColumn !== column) return <ArrowUp size={12} className="text-slate-600" />;
  return sortDirection === 'asc'
    ? <ArrowUp size={12} className="text-[#3B82F6]" />
    : <ArrowDown size={12} className="text-[#3B82F6]" />;
}

export default function TrendDataTable({ items }: TrendDataTableProps) {
  const router = useRouter();
  const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);
  const rowsDropdownRef = useRef<HTMLDivElement>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    pagination.setPage(0);
  };

  const sortedItems = [...items].sort((a, b) => {
    if (!sortColumn) return 0;

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
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const pagination = usePagination({
    totalItems: sortedItems.length,
    initialRowsPerPage: 10,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rowsDropdownRef.current && !rowsDropdownRef.current.contains(e.target as Node)) {
        setRowsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRowsPerPageChange = (value: number) => {
    pagination.setRowsPerPage(value);
    setRowsDropdownOpen(false);
  };

  const paginatedItems = sortedItems.slice(pagination.startIndex, pagination.endIndex);

  return (
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
                TICKER <SortIcon column="symbol" sortColumn={sortColumn} sortDirection={sortDirection} />
              </span>
            </th>
            <th
              onClick={() => handleSort('impact')}
              className="text-left text-xs font-bold text-white uppercase tracking-wider px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <span className="inline-flex items-center gap-1">
                IMPACT <SortIcon column="impact" sortColumn={sortColumn} sortDirection={sortDirection} />
              </span>
            </th>
            <th
              onClick={() => handleSort('sentiment')}
              className="text-left text-xs font-bold text-white uppercase tracking-wider px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <span className="inline-flex items-center gap-1">
                SENTIMENT <SortIcon column="sentiment" sortColumn={sortColumn} sortDirection={sortDirection} />
              </span>
            </th>
            <th
              onClick={() => handleSort('mention')}
              className="text-center text-xs font-bold text-white uppercase tracking-wider px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <span className="inline-flex items-center gap-1 justify-center">
                MENTION <SortIcon column="mention" sortColumn={sortColumn} sortDirection={sortDirection} />
              </span>
            </th>
            <th className="text-left text-xs font-bold text-white uppercase tracking-wider px-4 py-3">
              SENTIMENT HISTORICAL
            </th>
            <th
              onClick={() => handleSort('score')}
              className="text-right text-xs font-bold text-white uppercase tracking-wider px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <span className="inline-flex flex-col items-end">
                <span className="inline-flex items-center gap-1">
                  SCORE <SortIcon column="score" sortColumn={sortColumn} sortDirection={sortDirection} />
                </span>
                <span className="text-[11px] font-medium text-slate-400 tracking-normal">(-10 to 10)</span>
              </span>
            </th>
            <th className="text-center text-xs font-bold text-white uppercase tracking-wider px-4 py-3">
              STAT
            </th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                No results found
              </td>
            </tr>
          ) : paginatedItems.map((item) => {
            const impact = impactConfigCompact[item.impactLevel];
            const sentiment = sentimentConfig[item.sentiment];
            const SentimentIcon = sentiment.icon;

            return (
              <tr
                key={item.symbol}
                onClick={() => router.push(`/stock-sentiment/${item.symbol.toLowerCase()}`)}
                className="border-b border-[#222F44] hover:bg-white/5 transition-colors cursor-pointer"
              >
                {/* Ticker */}
                <td className="px-4 py-3">
                  <span className="text-[#0D7FF2] font-bold text-sm">
                    ${item.symbol}
                  </span>
                </td>

                {/* Impact Badge */}
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'text-xs font-bold px-4 py-1.5 rounded-full',
                      impact.bg,
                      impact.text,
                      impact.border
                    )}
                  >
                    {impact.label}
                  </span>
                </td>

                {/* Sentiment */}
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold',
                      sentiment.bg
                    )}
                  >
                    <SentimentIcon size={14} className={sentiment.iconColor} />
                    <span className={sentiment.textColor}>{sentiment.label}</span>
                  </span>
                </td>

                {/* Mention Count */}
                <td className="px-4 py-3 text-center">
                  <span className="text-white text-sm font-bold">{item.mentionCount}</span>
                </td>

                {/* Sentiment Historical Bar */}
                <td className="px-4 py-3">
                  <SentimentHistoricalBar data={item.sentimentHistorical} height={6} />
                </td>

                {/* Score */}
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 rounded-full border border-[#222F44] text-white font-bold text-sm">
                    {item.score}
                  </span>
                </td>

                {/* Reliability */}
                <td className="px-4 py-3 text-center">
                  {item.accuracy != null ? (() => {
                    const acc = item.accuracy as number;
                    const color = acc >= 70
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : acc >= 40
                      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      : 'bg-red-500/20 text-red-400 border-red-500/30';
                    return (
                      <span className={cn('inline-flex items-center justify-center min-w-[48px] px-2 py-1 rounded-full border text-xs font-bold', color)}>
                        {acc}%
                      </span>
                    );
                  })() : (
                    <span className="text-slate-500 text-xs">N/A</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[#222F44] bg-[#0a1017]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white">Rows per page:</span>
          <div className="relative" ref={rowsDropdownRef}>
            <button
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#333333] text-white text-sm"
              onClick={() => setRowsDropdownOpen(!rowsDropdownOpen)}
            >
              {pagination.rowsPerPage}
              <ChevronDown size={14} className={cn('transition-transform', rowsDropdownOpen && 'rotate-180')} />
            </button>
            {rowsDropdownOpen && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-[#1A1A1A] border border-[#333333] rounded-lg shadow-xl overflow-hidden min-w-[60px]">
                {ROWS_PER_PAGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleRowsPerPageChange(option)}
                    className={cn(
                      'block w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors',
                      pagination.rowsPerPage === option ? 'text-[#0D7FF2] bg-white/5' : 'text-white'
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={pagination.prevPage}
            disabled={!pagination.canGoPrev}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white"
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
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
