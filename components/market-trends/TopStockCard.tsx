'use client';

import { useRouter } from 'next/navigation';
import { TickerAnalysis } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tickerToast } from '@/lib/toast';

interface StockCardProps {
  item: TickerAnalysis;
  onRemove?: (symbol: string) => void;
}

const sentimentConfig = {
  up: { icon: TrendingUp, iconColor: 'text-[#10B981]', bgColor: 'bg-[#17382D]', label: 'Positive', dotColor: 'bg-[#10B981]', barColor: 'bg-[#10B981]', textColor: 'text-[#22C55E]' },
  down: { icon: TrendingDown, iconColor: 'text-[#EF4444]', bgColor: 'bg-[#592424]', label: 'Negative', dotColor: 'bg-[#EF4444]', barColor: 'bg-[#EF4444]', textColor: 'text-[#EF4444]' },
  flat: { icon: Minus, iconColor: 'text-[#808080]', bgColor: 'bg-[#262626]', label: 'Neutral', dotColor: 'bg-[#7F7F7F]', barColor: 'bg-[#7F7F7F]', textColor: 'text-slate-400' },
};

export default function StockCard({ item, onRemove }: StockCardProps) {
  const router = useRouter();
  const config = sentimentConfig[item.sentiment];
  const TrendIcon = config.icon;

  return (
    <div className={cn('relative', onRemove && 'group')}>
      <div
        onClick={() => router.push(`/stock-sentiment/${item.symbol.toLowerCase()}`)}
        className="bg-[#0a1017] border border-[#222F44] rounded-xl p-4 flex flex-col gap-3 hover:border-[#666] transition-colors cursor-pointer h-full">
        {/* Header: Symbol + Trend Icon */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-white font-bold text-base">{item.symbol}</h3>
            <p className="text-[#808080] text-xs line-clamp-2 min-h-[32px]">{item.name}</p>
          </div>
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
              config.bgColor
            )}
          >
            <TrendIcon size={16} className={config.iconColor} />
          </div>
        </div>

        {/* Details: Sentiment, Impact, Stat */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#222F44] text-xs select-none">
          <div className="flex justify-between items-center">
            <span className="text-[#808080] text-[11px] font-medium uppercase tracking-wider">Sentiment</span>
            <span className={cn('font-bold', config.textColor)}>{config.label}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#808080] text-[11px] font-medium uppercase tracking-wider">Impact</span>
            <span className={cn('font-bold', 
              item.impactLevel === 'high' ? 'text-red-400' :
              item.impactLevel === 'medium' ? 'text-amber-400' : 'text-blue-400'
            )}>{item.impactLevel?.toUpperCase() || 'LOW'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#808080] text-[11px] font-medium uppercase tracking-wider">Stat</span>
            <span className="font-bold text-white">
              {item.accuracy != null ? `${(item.accuracy / 10).toFixed(1)}/10` : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Remove button - only shown if onRemove is provided */}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(item.symbol); tickerToast.removed(item.symbol, 'watchlist'); }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-red-500/40 z-10"
        >
          <X size={12} className="text-red-400" />
        </button>
      )}
    </div>
  );
}

// Keep the old name as an alias for backward compatibility
export { StockCard as TopStockCard };
