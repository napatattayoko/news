'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RangeDropdown, { RangeOption } from '@/components/filters/RangeDropdown';
import { SentimentHistoricalBar } from '@/components/market-trends';
import { mockStockSentiment } from '@/lib/api';
import { useTerminalStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { impactConfigCompact } from '@/lib/constants';
import { Rss, X, Plus, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronLeft, ChevronRight, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { ImpactLevel, TrendFilter } from '@/lib/types';
import SentimentFilterRibbon from '@/components/filters/SentimentFilterRibbon';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import { usePagination } from '@/hooks/usePagination';
import { useTickersStats } from '@/hooks/useTickersStats';
import { tickerToast, toast } from '@/lib/toast';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { DraggableTableRow } from '@/components/stock-discovery/DraggableTableRow';

type TimeRange = '24H' | '7D';

const rangeOptions: RangeOption<TimeRange>[] = [
  { value: '24H', label: 'Last 24H' },
  { value: '7D', label: 'Last 7D' },
];

type SortColumn = 'symbol' | 'impact' | 'sentiment' | 'mention' | 'score';
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
  const { sentimentTickers, sentimentTickerOrder, addSentimentTicker, removeSentimentTicker, setSentimentTickerOrder, news } = useTerminalStore();
  const [rppOpen, setRppOpen] = useState(false);
  const rppRef = useRef<HTMLDivElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const addRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [selectedRange, setSelectedRange] = useState<TimeRange>('24H');
  const [activeFilter, setActiveFilter] = useState<TrendFilter>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    pagination.setPage(0);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = paged.findIndex((row) => row.symbol === active.id);
      const newIndex = paged.findIndex((row) => row.symbol === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newPagedOrder = arrayMove(paged, oldIndex, newIndex);
        // Update the full order by merging with existing order
        const newFullOrder = [...newPagedOrder.map(r => r.symbol)];

        // Add any symbols not in current page
        sentimentTickers.forEach(symbol => {
          if (!newFullOrder.includes(symbol)) {
            newFullOrder.push(symbol);
          }
        });

        setSentimentTickerOrder(newFullOrder);
      }
    }
  };

  // Dynamically extract unique tickers from actual news data
  const availableToAdd = Array.from(new Set(
    news.flatMap(item => item.tickers?.map(t => typeof t === 'string' ? t : t.symbol) || [])
  ))
  .filter(symbol => !sentimentTickers.includes(symbol as string))
  .map(symbol => ({ symbol: symbol as string, name: symbol as string }));

  const filteredToAdd = addSearch.trim()
    ? availableToAdd.filter((t) => 
        t.symbol.toLowerCase().includes(addSearch.trim().toLowerCase())
      )
    : availableToAdd;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
      if (rppRef.current && !rppRef.current.contains(e.target as Node)) setRppOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAddTicker = (symbol: string) => {
    addSentimentTicker(symbol);
    setAddOpen(false);

    // Check if there is any news for this ticker in the last 24h
    const tickerNews = news.filter(item => {
      const tickersList = item.tickers || [];
      return tickersList.some((t: any) => {
        const sym = typeof t === 'string' ? t : t.symbol;
        return sym.toUpperCase() === symbol.toUpperCase();
      });
    });

    const now = Date.now();
    const has24HNews = tickerNews.some(n => {
      const pubDate = new Date(n.publishedAt).getTime();
      return now - pubDate <= 24 * 60 * 60 * 1000;
    });

    if (selectedRange === '24H' && !has24HNews) {
      toast.warning(
        `Added $${symbol}`,
        `หุ้นนี้ไม่มีข่าวใหม่ใน 24 ชม. ล่าสุด ลองเปลี่ยนช่วงเวลาด้านบนเป็น "Last 7D" เพื่อดูข้อมูลย้อนหลังนะครับ`
      );
    } else {
      tickerToast.added(symbol, 'sentiment');
    }
  };

  const baseRows = useTickersStats(sentimentTickers, selectedRange);

  // Apply sentiment filter + sort
  const filteredRows = (() => {
    let filtered = [...baseRows];
    if (selectedRange === '24H') {
      filtered = filtered.filter((r) => r.mentionCount > 0);
    }
    switch (activeFilter) {
      case 'top_positive':
        filtered = filtered.filter((r) => r.sentiment === 'up');
        break;
      case 'top_negative':
        filtered = filtered.filter((r) => r.sentiment === 'down');
        break;
    }
    // Default sort: by filter type (unless using custom order)
    if (activeFilter !== 'all' || sortColumn) {
      switch (activeFilter) {
        case 'top_positive':
          filtered.sort((a, b) => b.score - a.score);
          break;
        case 'top_negative':
          filtered.sort((a, b) => a.score - b.score);
          break;
        case 'most_mention':
          filtered.sort((a, b) => b.mentionCount - a.mentionCount);
          break;
        default:
          filtered.sort((a, b) => b.score - a.score);
      }
    } else if (sentimentTickerOrder.length > 0) {
      // Apply custom order from drag-and-drop
      filtered.sort((a, b) => {
        const indexA = sentimentTickerOrder.indexOf(a.symbol);
        const indexB = sentimentTickerOrder.indexOf(b.symbol);
        // If not in custom order, place at end
        const orderA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
        const orderB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
        return orderA - orderB;
      });
    }
    return filtered;
  })();

  // Apply column sorting
  const rows = sortColumn ? [...filteredRows].sort((a, b) => {
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
  }) : filteredRows;

  const pagination = usePagination({
    totalItems: rows.length,
    initialRowsPerPage: 10,
  });

  const paged = rows.slice(pagination.startIndex, pagination.endIndex);

  return (
    <>
      {/* Center content area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-28 lg:pb-0">
        {/* Header */}
        <div className="px-4 md:px-6 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Rss size={18} className="text-white md:w-5 md:h-5" />
            <h1 className="text-base md:text-lg font-extrabold text-white uppercase tracking-wide whitespace-nowrap">
              STOCK SENTIMENT
            </h1>
          </div>

          <RangeDropdown
            options={rangeOptions}
            value={selectedRange}
            onChange={setSelectedRange}
          />
        </div>

        {/* Ticker Filter Bar */}
        <div className="px-4 md:px-6 pb-4 flex items-center gap-2">
          {/* ADD button - fixed position to avoid dropdown clipping */}
          <div className="relative shrink-0" ref={addRef}>
            <button
              onClick={() => { setAddOpen(!addOpen); setAddSearch(''); setTimeout(() => addInputRef.current?.focus(), 0); }}
              className="flex items-center gap-2 bg-[#0D7FF2] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-[#0B6FD4] transition-colors"
            >
              <Plus size={14} />
              ADD
            </button>
            {addOpen && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-[#1A1A1A] border border-[#222F44] rounded-lg shadow-xl overflow-hidden w-56">
                <div className="px-3 py-2 border-b border-[#222F44]">
                  <div className="flex items-center gap-2 bg-[#111722] rounded-lg px-2 py-1.5">
                    <Search size={13} className="text-slate-500 shrink-0" />
                    <input
                      ref={addInputRef}
                      type="text"
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      placeholder="Search symbol…"
                      className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                    {filteredToAdd.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-slate-500">
                        {addSearch.trim() ? 'No matches' : 'No more tickers'}
                      </div>
                    ) : (
                      filteredToAdd.slice(0, 50).map((ticker) => (
                        <button
                          key={ticker.symbol}
                          onClick={() => handleAddTicker(ticker.symbol)}
                          className="block w-full text-left px-4 py-2 hover:bg-white/10 transition-colors flex flex-col sm:flex-row sm:items-baseline gap-1"
                        >
                          <span className="text-sm font-bold text-white shrink-0">{ticker.symbol}</span>
                          <span className="text-xs text-slate-400 truncate">{ticker.name}</span>
                        </button>
                      ))
                    )}
                </div>
              </div>
            )}
          </div>

          {/* Scrollable ticker chips */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pr-4 md:pr-0">
            {sentimentTickers.map((symbol) => (
              <div
                key={symbol}
                className="flex items-center gap-2 bg-[#2A2A2A] border border-[#222F44] text-white text-sm font-medium px-4 py-2 rounded-full shrink-0"
              >
                {symbol}
                <button
                  onClick={() => { removeSentimentTicker(symbol); tickerToast.removed(symbol, 'sentiment'); }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment Filter Ribbon */}
        <div className="px-4 md:px-6 pt-2 pb-6">
          <SentimentFilterRibbon
            activeFilter={activeFilter}
            onFilterChange={(filter) => { setActiveFilter(filter); setSortColumn(null); setSortDirection('asc'); pagination.setPage(0); }}
          />
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-0 flex flex-col gap-4">
          {/* Table */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="border border-[#222F44] rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#222F44]">
                      {!sortColumn && activeFilter === 'all' && (
                        <th className="w-8 px-2 py-3"></th>
                      )}
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
                    </tr>
                  </thead>
                  <SortableContext items={paged.map(r => r.symbol)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {paged.length === 0 ? (
                        <tr>
                          <td colSpan={(!sortColumn && activeFilter === 'all') ? 7 : 6} className="px-4 py-8 text-center text-slate-500 text-sm">
                            {sentimentTickers.length === 0 ? 'Add tickers to get started' : 'No results found'}
                          </td>
                        </tr>
                      ) : paged.map((row) => {
                        const impact = impactConfigCompact[row.impactLevel];
                        const sent = sentimentConfig[row.sentiment];
                        const SentIcon = sent.icon;
                        const isDragDisabled = sortColumn !== null || activeFilter !== 'all';

                        return (
                          <DraggableTableRow
                            key={row.symbol}
                            id={row.symbol}
                            onClick={() => router.push(`/stock-sentiment/${row.symbol.toLowerCase()}`)}
                            isDragDisabled={isDragDisabled}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-[#0D7FF2] font-bold text-sm">${row.symbol}</span>
                                {row.latestNewsDate && selectedRange === '7D' && (
                                  <span className="text-slate-500 text-xs font-normal">
                                    ({new Date(row.latestNewsDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})
                                  </span>
                                )}
                              </div>
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
                          </DraggableTableRow>
                        );
                      })}
                    </tbody>
                  </SortableContext>
                </table>
              </div>

              {/* Pagination — outside overflow-x-auto so dropdown is not clipped */}
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
                            onClick={() => { pagination.setRowsPerPage(n); setRppOpen(false); }}
                            className={cn(
                              'block w-full text-left px-4 py-2 text-sm font-bold hover:bg-white/8 transition-colors',
                              pagination.rowsPerPage === n ? 'text-[#0D7FF2] bg-white/5' : 'text-white'
                            )}
                          >
                            {n}
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
          </DndContext>
        </div>
      </div>
      <ScrollToTopButton scrollContainerRef={scrollRef} />
    </>
  );
}
