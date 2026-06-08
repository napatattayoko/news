'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { useTerminalStore } from '@/lib/store';
import { NewsItem } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import TickerChip from '@/components/tickers/TickerChip';

const HOURS_24 = 24 * 60 * 60 * 1000;

function getDomain(url: string) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function BreakingCard({ item, large = false }: { item: NewsItem; large?: boolean }) {
  const src = item.sources[0];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => src?.url && window.open(src.url, '_blank', 'noopener,noreferrer')}
      onKeyDown={(e) => { if (e.key === 'Enter' && src?.url) window.open(src.url, '_blank', 'noopener,noreferrer'); }}
      className={`group flex flex-col overflow-hidden rounded-xl cursor-pointer border border-[#222F44] bg-[#0d1520] ${large ? 'row-span-2' : ''}`}
      aria-label={item.headline}
    >
      {/* Image */}
      <div className={`relative overflow-hidden ${large ? 'aspect-[16/10]' : 'aspect-[16/9]'}`}>
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.headline}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#1a2332] to-[#0a1017]" />
        )}
        {/* Impact badge on image */}
        <span className="absolute top-2 left-2 inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400 bg-red-500/20 border border-red-500/30 backdrop-blur-sm">
          HIGH IMPACT
        </span>
      </div>

      {/* Content */}
      <div className={`flex flex-col ${large ? 'p-5 gap-3' : 'p-4 gap-2.5'}`}>
        {/* Headline */}
        <h3 className={`font-bold leading-snug text-white uppercase ${large ? 'text-xl line-clamp-3' : 'text-base line-clamp-2'}`}>
          {item.headline}
        </h3>

        {/* Tickers */}
        {item.tickers.length > 0 && (
          <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
            {item.tickers.map((t) => (
              <TickerChip key={t.symbol} symbol={t.symbol} trend={t.sentiment} />
            ))}
          </div>
        )}

        {/* Source + time */}
        <div className="flex items-center gap-2 pt-3 mt-auto border-t border-[#222F44] leading-none">
          {src && (
            <>
              <Image
                src={`https://www.google.com/s2/favicons?domain=${getDomain(src.url)}&sz=32`}
                alt={src.name}
                width={16}
                height={16}
                className="h-4 w-4 rounded-full bg-[#333]"
                unoptimized
              />
              <span className="text-sm text-slate-400">
                {src.name.charAt(0) + src.name.slice(1).toLowerCase()} Reporting
              </span>
              <span className="text-xl text-slate-500 pt-[2px]">·</span>
            </>
          )}
          <span className="text-xs text-slate-400 pt-[2.9px] " suppressHydrationWarning>
            {timeAgo(item.publishedAt)}
          </span>
          <a
            href={src?.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-sm font-medium text-[#0D7FF2] hover:text-[#3399FF] transition-colors"
          >
            View more
          </a>
        </div>
      </div>
    </div>
  );
}

export default function BreakingNews() {
  const { news, activeCategory } = useTerminalStore();

  const breakingItems = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - HOURS_24);
    let items = news
      .filter((n) => n.impact === 'high' && new Date(n.publishedAt) >= cutoff);

    if (activeCategory !== 'all') {
      items = items.filter((n) => n.category === activeCategory);
    }

    // Sort by latest first
    items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return items.slice(0, 3);
  }, [activeCategory, news]);

  if (breakingItems.length === 0) return null;

  return (
    <section className="px-4 pt-4 pb-6 mb-2 border-b border-[#222F44]">
      <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-3">
        Breaking News
      </h2>

      {/* Desktop: 1 large + 2 small grid */}
      <div className="hidden md:grid grid-cols-2 auto-rows-[250px] gap-4">
        {breakingItems[0] && <BreakingCard item={breakingItems[0]} large />}
        {breakingItems[1] && <BreakingCard item={breakingItems[1]} />}
        {breakingItems[2] && <BreakingCard item={breakingItems[2]} />}
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
