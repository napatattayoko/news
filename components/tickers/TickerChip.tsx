'use client';

import { cn } from '@/lib/utils';
import { useTerminalStore } from '@/lib/store';
import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';
import { tickerToast } from '@/lib/toast';

interface TickerChipProps {
  symbol: string;
  showBookmark?: boolean;
  trend?: 'up' | 'down' | 'flat';
  size?: 'sm' | 'md';
}

export default function TickerChip({ symbol, showBookmark = true, trend = 'flat', size = 'sm' }: TickerChipProps) {
  const { activeTicker, setTicker, trackedTickers, addTicker, removeTicker } = useTerminalStore();

  // ป้องกันบักที่ระบบดึงตัวเลขมาเป็น ticker (เช่น 548, 000) โดยยอมรับเฉพาะตัวอักษรเท่านั้น
  if (!/^[A-Za-z]+$/.test(symbol)) {
    return null;
  }

  const active = activeTicker === symbol;
  const isTracked = trackedTickers.includes(symbol);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500';

  function handleStarClick(e: React.SyntheticEvent) {
    e.stopPropagation();
    if (isTracked) {
      removeTicker(symbol);
      tickerToast.removed(symbol, 'watchlist');
    } else {
      addTicker(symbol);
      tickerToast.added(symbol, 'watchlist');
    }
  }

  return (
    <button
      onClick={() => setTicker(symbol)}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-150 select-none',
        size === 'md' && 'px-3.5 py-2 text-base',
        active
          ? 'bg-[#0D7FF2]/20 text-[#0D7FF2] border border-[#0D7FF2]/40 shadow-[0_0_8px_rgba(13,127,242,0.15)]'
          : 'bg-[#111722] text-white border border-[#222F44] hover:bg-[#3a3a3a] hover:border-[#0D7FF2]/30'
      )}
    >
      <span className="text-slate-400 font-normal">$</span>
      <span className="tracking-wide">{symbol}</span>
      <TrendIcon size={14} className={trendColor} />
      {showBookmark && (
        <span
          role="button"
          tabIndex={0}
          onClick={handleStarClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStarClick(e); } }}
          className="ml-0.5 inline-flex"
          aria-label={isTracked ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
        >
          <Star
            size={12}
            className={cn(
              'transition-colors',
              isTracked ? 'text-yellow-400 fill-yellow-400' : 'text-slate-500 hover:text-yellow-400'
            )}
          />
        </span>
      )}
    </button>
  );
}
