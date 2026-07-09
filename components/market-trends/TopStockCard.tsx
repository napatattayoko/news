'use client';

import { useRouter } from 'next/navigation';
import { TickerAnalysis } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import Tooltip, { TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip';
import { tickerToast } from '@/lib/toast';

interface StockCardProps {
  item: TickerAnalysis;
  onRemove?: (symbol: string) => void;
}

const sentimentConfig = {
  up: { icon: TrendingUp, iconColor: 'text-[#10B981]', bgColor: 'bg-[#17382D]', label: 'Positive', dotColor: 'bg-[#10B981]', barColor: 'bg-[#10B981]', textColor: 'text-white' },
  down: { icon: TrendingDown, iconColor: 'text-[#EF4444]', bgColor: 'bg-[#592424]', label: 'Negative', dotColor: 'bg-[#EF4444]', barColor: 'bg-[#EF4444]', textColor: 'text-[#EF4444]' },
  flat: { icon: Minus, iconColor: 'text-[#808080]', bgColor: 'bg-[#262626]', label: 'Neutral', dotColor: 'bg-[#7F7F7F]', barColor: 'bg-[#7F7F7F]', textColor: 'text-white' },
};

export default function StockCard({ item, onRemove }: StockCardProps) {
  const router = useRouter();
  const config = sentimentConfig[item.sentiment];
  const TrendIcon = config.icon;
  const barWidth = Math.round((Math.abs(item.score) / 10) * 100);

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

        {/* Sentiment Score */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-white text-xs font-medium">Sentiment Score</span>
              <Tooltip content="Score ranges from -10 to +10">
                <Info size={14} className="text-slate-500 cursor-help" />
              </Tooltip>
            </div>
            <span className="text-white font-semibold text-sm">
              {item.score > 0 ? `+${item.score}` : item.score}/10
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-2 w-full bg-[#2A2A2A] rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', config.barColor)}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* Sentiment Badge */}
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', config.dotColor)} />
          <span className={cn('text-xs font-medium', config.textColor)}>{config.label}</span>
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
