'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import RangeDropdown, { RangeOption } from '@/components/filters/RangeDropdown';
import { SentimentDonutChart, SentimentScoreCard, StockDetailNewsFeed } from '@/components/stock-detail';
import { TradingViewSymbolOverview } from '@/components/market-trends';
import { useTickerStats } from '@/hooks/useTickersStats';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

type TimeRange = '24H' | '7D' | '30D' | 'All';

const rangeOptions: RangeOption<TimeRange>[] = [
  { value: '24H', label: 'Last 24H' },
  { value: '7D', label: 'Last 7D' },
  { value: '30D', label: 'Last 30D' },
  { value: 'All', label: 'All' },
];

export default function StockDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const dateParam = searchParams?.get('date');
  const symbol = (params.symbol as string)?.toUpperCase() ?? '';
  const [selectedRange, setSelectedRange] = useState<TimeRange>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedRange_sentiment') as TimeRange;
      if (saved === '24H' || saved === '7D' || saved === '30D' || saved === 'All') return saved;
    }
    return '24H';
  });

  const handleRangeChange = (newRange: TimeRange) => {
    setSelectedRange(newRange);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedRange_sentiment', newRange);
    }
  };

  const [stockPrice, setStockPrice] = useState<string>('');
  const [priceChange, setPriceChange] = useState<string>('');
  const [priceChangeVal, setPriceChangeVal] = useState<number>(0);
  const [aiOutlook, setAiOutlook] = useState<string>('Analyzing market signals...');

  const row = useTickerStats(symbol, selectedRange);

  useEffect(() => {
    let isMounted = true;

    const fetchQuote = async () => {
      try {
        const res = await fetch(`/api/finviz?action=quote&symbol=${symbol}`);
        const result = await res.json();
        if (isMounted && result.success && result.data?.quote) {
          const price = result.data.quote['Price'];
          const change = result.data.quote['Change'];
          setStockPrice(price || '');
          setPriceChange(change || '');
          setPriceChangeVal(parseFloat(change) || 0);
        }
      } catch (err) {
        console.error('[StockDetailPage] Failed to fetch quote:', err);
      }
    };

    const fetchOutlook = async () => {
      try {
        const res = await fetch(`/api/ai-outlook?symbol=${symbol}`);
        const result = await res.json();
        if (isMounted) {
          if (result.success && result.outlook) {
            setAiOutlook(result.outlook);
          } else {
            setAiOutlook('No AI analysis available for this ticker.');
          }
        }
      } catch (err) {
        console.error('[StockDetailPage] Failed to fetch AI outlook:', err);
        if (isMounted) {
          setAiOutlook('No AI analysis available for this ticker.');
        }
      }
    };

    if (symbol) {
      fetchQuote();
      fetchOutlook();
    }

    return () => {
      isMounted = false;
    };
  }, [symbol]);

  if (!row) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-400 text-sm">No sentiment data found for <span className="text-[#0D7FF2] font-bold">${symbol}</span></p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111722] border border-[#222F44] text-white text-sm font-semibold hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Overview
        </button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto pb-28 lg:pb-0">
        {/* Top Header Bar */}
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111722] border border-[#222F44] text-slate-300 text-xs font-semibold hover:bg-white/10 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <h1 className="text-xl font-extrabold text-white uppercase tracking-wide">
              <span>${symbol}</span>
            </h1>
            {stockPrice && (
              <div className="flex items-center gap-2 bg-[#111722] border border-[#222F44] px-3 py-1 rounded-lg text-sm font-semibold select-none">
                <span className="text-slate-300 font-medium">${stockPrice}</span>
                <span className={priceChangeVal >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {priceChange}
                </span>
              </div>
            )}
          </div>
          <RangeDropdown
            options={rangeOptions}
            value={selectedRange}
            onChange={handleRangeChange}
          />
        </div>

        <div className="px-6 pb-6 pt-0 flex flex-col gap-6">
          {/* Full Screen TradingView Symbol Overview Chart (Featured First) */}
          <div>
            <TradingViewSymbolOverview
              symbols={[symbol]}
              title={`${symbol} — Live TradingView Symbol Overview`}
              height={650}
            />
          </div>

          {/* Collateral Sentiment Cards */}
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
          {/* Related News Feed */}
          <StockDetailNewsFeed symbol={symbol} range={selectedRange} date={dateParam || undefined} />
        </div>
      </div>
    </TooltipProvider>
  );
}
