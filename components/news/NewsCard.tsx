'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { NewsItem, Region } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';
import { impactConfigFull, CountryFlag } from '@/lib/constants';
import TickerChip from '@/components/tickers/TickerChip';

function getDomain(url: string) {
  try { return new URL(url).hostname; } catch { return ''; }
}

interface NewsCardProps {
  item: NewsItem;
  compact?: boolean;
}

export default function NewsCard({ item, compact = false }: NewsCardProps) {
  const impact = impactConfigFull[item.impact];

  return (
    <article
      id={`news-${item.id}`}
      className={cn(
        'flex flex-col h-full bg-[#0a1017] border-y border-r border-[#222F44] border-l-4 rounded-xl p-4 transition-all duration-200 hover:bg-[#111722] group cursor-pointer',
        item.sentiment === 'good' ? 'border-l-green-500/70' : item.sentiment === 'bad' ? 'border-l-red-500/70' : 'border-l-slate-500/50',
        item.impact === 'high' ? 'hover:border-r-red-500/40' : 'hover:border-r-[#666]',
        compact && 'p-3'
      )}
    >
      {/* Header: impact badge + time + flag */}
      <div className="flex items-center justify-between mb-2.5">
        <span
          className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-md border',
            impact.bg, impact.text, impact.border
          )}
        >
          {impact.label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500" suppressHydrationWarning>{timeAgo(item.publishedAt)}</span>
          <CountryFlag code={item.countryCode} />
        </div>
      </div>

      {/* Headline */}
      <h3
        className={cn(
          'font-bold text-white leading-snug mb-2 group-hover:text-cyan-50 transition-colors uppercase line-clamp-2',
          compact ? 'text-base' : 'text-lg'
        )}
      >
        {highlightTickers(item.headline)}
      </h3>

      {/* Body */}
      {!compact && (
        <p className="text-sm text-slate-400 leading-relaxed mb-3 line-clamp-3 flex-1">
          {highlightTickers(item.body)}
        </p>
      )}

      {/* Tickers */}
      <div className="flex flex-wrap gap-1.5 mt-2 mb-4">
        {item.tickers.map((t, i) => (
          <TickerChip
            key={`${t.symbol}-${i}`}
            symbol={t.symbol}
            trend={t.sentiment}
            showBookmark
          />
        ))}
      </div>

      {/* Footer: sources + view more */}
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#222F44]">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {item.sources.map((s) => (
              <Image key={s.name} src={`https://www.google.com/s2/favicons?domain=${getDomain(s.url)}&sz=32`} alt={s.name} width={24} height={24} className="w-6 h-6 rounded-full border-2 border-[#0d0d0d] bg-[#333]" unoptimized />
            ))}
          </div>
          <span className="text-sm text-slate-400">
            {item.sources.map((s) => s.name.charAt(0) + s.name.slice(1).toLowerCase()).join(', ')} Reporting
          </span>
        </div>
        <SourcesPopup sources={item.sources} />
      </div>
    </article>
  );
}

function SourcesPopup({ sources }: { sources: { name: string; url: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // If only one source, go directly to the link
  if (sources.length === 1) {
    return (
      <a
        href={sources[0].url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-xs font-medium transition-colors text-[#0D7FF2] hover:text-[#3399FF] underline"
      >
        View more
      </a>
    );
  }

  // Multiple sources - show dropdown
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="text-xs font-medium transition-colors text-[#0D7FF2] hover:text-[#3399FF] underline"
      >
        View more
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-48 bg-[#222] border border-[#222F44] rounded-lg shadow-xl z-50 py-1">
          {sources.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-cyan-400 transition-colors"
            >
              <Image src={`https://www.google.com/s2/favicons?domain=${getDomain(s.url)}&sz=32`} alt={s.name} width={12} height={12} className="w-3 h-3 rounded-full shrink-0 bg-[#333]" unoptimized />
              {s.name.charAt(0) + s.name.slice(1).toLowerCase()}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function highlightTickers(text: string) {
  const parts = text.split(/(\$[A-Z]{1,5})/g);
  return parts.map((part, i) =>
    part.startsWith('$') ? (
      <span key={i} className="text-cyan-400 font-semibold">
        {part}
      </span>
    ) : (
      part
    )
  );
}
