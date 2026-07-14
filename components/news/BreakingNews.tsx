'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { useTerminalStore } from '@/lib/store';
import { NewsItem } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import TickerChip from '@/components/tickers/TickerChip';



import { highlightTickers } from './NewsCard';

function getDomain(url: string) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function BreakingCard({ item, large = false, className = '' }: { item: NewsItem; large?: boolean; className?: string }) {
  const src = item.sources[0];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => src?.url && window.open(src.url, '_blank', 'noopener,noreferrer')}
      onKeyDown={(e) => { if (e.key === 'Enter' && src?.url) window.open(src.url, '_blank', 'noopener,noreferrer'); }}
      className={`group flex flex-col h-full bg-[#0a1017] border border-[#222F44] border-l-4 rounded-xl p-4 transition-all duration-200 hover:bg-[#111722] cursor-pointer ${item.sentiment === 'good' ? 'border-l-green-500/70' : item.sentiment === 'bad' ? 'border-l-red-500/70' : 'border-l-slate-500/50'
        } ${large ? 'row-span-2' : ''} ${className}`}
      aria-label={item.headline}
    >
      {/* Header: impact badge + time */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-bold px-2 py-0.5 rounded-md border text-red-400 bg-red-500/20 border-red-500/30">
          HIGH IMPACT
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500" suppressHydrationWarning>
            {timeAgo(item.publishedAt)}
          </span>
        </div>
      </div>

      {/* Headline */}
      <h3 className={`font-bold leading-snug text-white uppercase mb-2 ${large ? 'text-lg' : 'text-base'}`}>
        {highlightTickers(item.headline, item.tickers.map(t => t.symbol))}
      </h3>

      {/* Body preview */}
      {item.body && (
        <p className={`text-sm text-slate-400 leading-relaxed mb-3 flex-1 ${large ? 'line-clamp-3' : 'line-clamp-2'}`}>
          {highlightTickers(item.body, item.tickers.map(t => t.symbol))}
        </p>
      )}

      {/* Tickers */}
      <div className="flex flex-wrap gap-1.5 mt-2 mb-4">
        {item.tickers.map((t) => (
          <TickerChip key={t.symbol} symbol={t.symbol} trend={t.sentiment} />
        ))}
      </div>

      {/* Footer: sources + view more */}
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#222F44]">
        <div className="flex items-center gap-2">
          {src && (
            <>
              <Image
                src={`https://www.google.com/s2/favicons?domain=${getDomain(src.url)}&sz=32`}
                alt={src.name}
                width={24}
                height={24}
                className="w-6 h-6 rounded-full border-2 border-[#0d0d0d] bg-[#333]"
                unoptimized
              />
              <span className="text-sm text-slate-400">
                {src.name.charAt(0) + src.name.slice(1).toLowerCase()} Reporting
              </span>
            </>
          )}
        </div>
        {src && (
          <a
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium transition-colors text-[#0D7FF2] hover:text-[#3399FF] underline"
          >
            View more
          </a>
        )}
      </div>
    </div>
  );
}

export default function BreakingNews() {
  const { news, activeCategory } = useTerminalStore();

  const breakingItems = useMemo(() => {
    let items = news
      .filter((n) => n.impact === 'high');

    if (activeCategory !== 'all') {
      items = items.filter((n) => n.category === activeCategory);
    }

    // Sort by latest first
    items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return items.slice(0, 4);
  }, [activeCategory, news]);

  if (breakingItems.length === 0) return null;

  return (
    <section className="px-4 pt-4 pb-6 mb-2 border-b border-[#222F44]">
      <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-3">
        Breaking News
      </h2>

      {/* Desktop: 4 Equal Grid Layout */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-2 gap-4">
        {breakingItems.map((item) => (
          <BreakingCard key={item.id} item={item} />
        ))}
      </div>

      {/* Mobile: vertical stack */}
      <div className="md:hidden space-y-3">
        {breakingItems.map((item) => (
          <BreakingCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
