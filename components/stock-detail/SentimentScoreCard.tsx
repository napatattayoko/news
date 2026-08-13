'use client';

import { TrendingUp, TrendingDown, Minus, Sparkles, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import Tooltip, { TooltipProvider } from '@/components/ui/Tooltip';

const sentimentConfig = {
  up: { label: 'Positive', icon: TrendingUp, textColor: 'text-[#22C55E]', iconColor: 'text-[#10B981]', bg: 'bg-[#17382D]', border: 'border-[#10B981]/30' },
  down: { label: 'Negative', icon: TrendingDown, textColor: 'text-[#EF4444]', iconColor: 'text-[#EF4444]', bg: 'bg-[#2F1E1E]', border: 'border-[#EF4444]/30' },
  flat: { label: 'Neutral', icon: Minus, textColor: 'text-[#808080]', iconColor: 'text-[#808080]', bg: 'bg-[#262626]', border: 'border-[#808080]/30' },
};

interface SentimentScoreCardProps {
  sentiment: 'up' | 'down' | 'flat';
  accuracy: number | null | undefined;
  aiOutlook: string;
  isLoading?: boolean;
}

export default function SentimentScoreCard({ sentiment, accuracy, aiOutlook, isLoading }: SentimentScoreCardProps) {
  const sent = sentimentConfig[sentiment];
  const SentIcon = sent?.icon;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 h-full">
        {/* Top row: Sentiment + Score Skeleton */}
        <div className="bg-[#0a1017] border border-[#333333] rounded-xl p-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Sentiment Skeleton */}
            <div className="flex flex-col items-center">
              <div className="h-4 w-16 bg-slate-800 rounded animate-pulse mb-3" />
              <div className="h-[48px] w-full bg-slate-800/40 rounded-lg animate-pulse" />
            </div>

            {/* Stat Skeleton */}
            <div className="flex flex-col items-center">
              <div className="h-4 w-12 bg-slate-800 rounded animate-pulse mb-3" />
              <div className="h-[48px] w-full bg-slate-800/40 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>

        {/* AI Intelligence Outlook Skeleton */}
        <div className="bg-[#0a1017] border border-[#333333] rounded-xl p-5 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-5 bg-slate-800 rounded-full animate-pulse" />
            <div className="h-5 w-44 bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="space-y-2 mt-4">
            <div className="h-4 w-full bg-slate-800/40 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-slate-800/40 rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-slate-800/40 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top row: Sentiment + Score */}
      <div className="bg-[#0a1017] border border-[#333333] rounded-xl p-5">
        <div className="grid grid-cols-2 gap-4">
          {/* Sentiment */}
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-bold text-white mb-3">Sentiment</h3>
            <span className={cn(
              'inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg text-base font-bold border',
              sent.bg, sent.border
            )}>
              <SentIcon size={18} className={sent.iconColor} />
              <span className={sent.textColor}>{sent.label}</span>
            </span>
          </div>

          {/* Stat */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-3">
              <h3 className="text-sm font-bold text-white">STAT</h3>
              <Tooltip content="Historical accuracy of the Score">
                <Info size={14} className="text-slate-500 cursor-help" />
              </Tooltip>
            </div>
            <div className="flex items-center justify-center w-full px-4 py-3 rounded-lg border border-[#333333] bg-[#0a1017]">
              {accuracy != null ? (
                <span className={cn(
                  "text-xl font-extrabold",
                  accuracy >= 60
                    ? 'text-emerald-400'
                    : accuracy >= 50
                    ? 'text-slate-400'
                    : 'text-red-400'
                )}>
                  {(accuracy / 10).toFixed(1)}/10
                </span>
              ) : (
                <span className="text-xl font-extrabold text-slate-500">-</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Intelligence Outlook */}
      <div className="bg-[#0a1017] border border-[#333333] rounded-xl p-5 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-[#0D7FF2]" />
          <h3 className="text-lg font-bold bg-gradient-to-r from-[#0D7FF2] to-[#60A5FA] bg-clip-text text-transparent">AI Intelligence Outlook</h3>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          &quot;{aiOutlook}&quot;
        </p>
      </div>
    </div>
  );
}
