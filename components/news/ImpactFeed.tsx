'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTerminalStore } from '@/lib/store';
import NewsCard from './NewsCard';
import NewsCardSkeleton from './NewsCardSkeleton';
import MobileSentimentToggle from './MobileSentimentToggle';
import { TrendingDown, TrendingUp, ChevronDown } from 'lucide-react';
import { NewsItem } from '@/lib/types';
import { CountryFlag } from '@/lib/constants';

const HOURS_24 = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 20;
const COUNTRY_INITIAL_ROWS = 10;

const detectSentiment = (title: string) => {
  const lower = title.toLowerCase();
  const goodWords = ['up', 'higher', 'surge', 'gain', 'buy', 'beat', 'strong', 'rally', 'dividend', 'upgrade', 'jump', 'soar', 'record', 'profit'];
  const badWords = ['down', 'lower', 'plunge', 'drop', 'sell', 'miss', 'weak', 'crash', 'cut', 'downgrade', 'fall', 'sink', 'lawsuit', 'probe', 'loss'];
  
  for (const word of goodWords) {
    if (lower.match(new RegExp(`\\b${word}\\b`))) return 'good';
  }
  for (const word of badWords) {
    if (lower.match(new RegExp(`\\b${word}\\b`))) return 'bad';
  }
  // Randomly distribute remaining news to keep both columns balanced
  return title.length % 3 === 0 ? 'good' : title.length % 3 === 1 ? 'bad' : 'neutral';
};

// Country ordering from big to small (major markets first)
const COUNTRY_ORDER: string[] = [
  'us', 'cn', 'jp', 'de', 'gb', 'fr', 'in', 'it', 'br', 'ca',
  'kr', 'au', 'es', 'mx', 'nl', 'ch', 'tw', 'th', 'sg', 'ie',
  'be', 'no', 'dk',
  'global'
];

// Country display names
const COUNTRY_NAMES: Record<string, string> = {
  'us': 'USA',
  'cn': 'China',
  'jp': 'Japan',
  'de': 'Germany',
  'gb': 'United Kingdom',
  'fr': 'France',
  'in': 'India',
  'it': 'Italy',
  'br': 'Brazil',
  'ca': 'Canada',
  'kr': 'South Korea',
  'au': 'Australia',
  'es': 'Spain',
  'mx': 'Mexico',
  'nl': 'Netherlands',
  'ch': 'Switzerland',
  'tw': 'Taiwan',
  'th': 'Thailand',
  'sg': 'Singapore',
  'ie': 'Ireland',
  'be': 'Belgium',
  'no': 'Norway',
  'dk': 'Denmark',
  'global': 'Global',
};

export default function ImpactFeed() {
  const { news, activeCountry, activeCategory, activeTicker, activeImpact, sortOrder, selectedSymbols, mobileSentiment, scrollToNewsId, setScrollToNewsId } = useTerminalStore();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [countryVisibleRows, setCountryVisibleRows] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Simulate initial loading for perceived performance
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const loadMoreCountryRows = (country: string) => {
    setCountryVisibleRows(prev => ({
      ...prev,
      [country]: (prev[country] || COUNTRY_INITIAL_ROWS) + COUNTRY_INITIAL_ROWS
    }));
  };

  const filtered = useMemo(() => {
    const now = new Date();
    let items = news;

    // Dashboard: only last 24 hours
    const cutoff = new Date(now.getTime() - HOURS_24);
    items = items.filter((n) => new Date(n.publishedAt) >= cutoff);

    // Filter by category
    if (activeCategory !== 'all') {
      items = items.filter((n) => n.category === activeCategory);
    }

    // Filter by country
    if (activeCountry !== 'all') {
      items = items.filter((n) => n.countryCode === activeCountry);
    }
    if (activeTicker) {
      items = items.filter((n) => n.tickers.some((t) => t.symbol === activeTicker));
    }
    if (activeImpact !== 'all') {
      items = items.filter((n) => n.impact === activeImpact);
    }

    if (selectedSymbols.length > 0) {
      items = items.filter((n) =>
        n.tickers.some((t) => selectedSymbols.includes(t.symbol))
      );
    }

    return items;
  }, [activeCategory, activeCountry, activeTicker, activeImpact, selectedSymbols, news]);

  // Reset pagination when filters change (moved inside render, no useEffect)
  const paginationKey = `${activeCategory}-${activeCountry}-${activeTicker}-${activeImpact}-${selectedSymbols.join(',')}`;
  const keySuffix = useMemo(() => paginationKey, [paginationKey]);

  // Group news by country
  const groupedByCountry = useMemo(() => {
    const groups: Record<string, NewsItem[]> = {};
    for (const item of filtered) {
      const country = item.countryCode;
      if (!groups[country]) groups[country] = [];
      groups[country].push(item);
    }

    // Sort countries by COUNTRY_ORDER
    const sortedCountries = Object.keys(groups).sort((a, b) => {
      const indexA = COUNTRY_ORDER.indexOf(a);
      const indexB = COUNTRY_ORDER.indexOf(b);
      const orderA = indexA === -1 ? 999 : indexA;
      const orderB = indexB === -1 ? 999 : indexB;
      return orderA - orderB;
    });

    return sortedCountries.map(country => ({
      country,
      name: COUNTRY_NAMES[country] || country.toUpperCase(),
      items: groups[country]
    }));
  }, [filtered, activeCountry]);

  // Scroll to a specific news card when selected from search overlay
  useEffect(() => {
    if (!scrollToNewsId) return;

    // Expand only the country group that contains the target news
    const targetGroup = groupedByCountry.find(({ items }) =>
      items.some((n) => n.id === scrollToNewsId)
    );
    if (targetGroup) {
      setCountryVisibleRows((prev) => ({
        ...prev,
        [targetGroup.country]: targetGroup.items.length,
      }));
    }

    // Delay to allow DOM to render after expand + filter reset
    const timer = setTimeout(() => {
      // Same news id exists in both mobile (md:hidden) and desktop sections
      // Use querySelectorAll + visibility check to find the actually visible one
      const candidates = document.querySelectorAll<HTMLElement>(`[id="news-${scrollToNewsId}"]`);
      const el = Array.from(candidates).find(e => e.offsetParent !== null);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-[#2962FF]');
        setTimeout(() => el.classList.remove('ring-2', 'ring-[#2962FF]'), 2000);
      }
      setScrollToNewsId(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [scrollToNewsId, setScrollToNewsId, groupedByCountry]);

  const sortItems = (list: typeof filtered) => {
    const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    if (sortOrder === 'latest') {
      return [...list].sort((a, b) => {
        const timeDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        return timeDiff !== 0 ? timeDiff : impactOrder[a.impact] - impactOrder[b.impact];
      });
    } else if (sortOrder === 'oldest') {
      return [...list].sort((a, b) => {
        const timeDiff = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
        return timeDiff !== 0 ? timeDiff : impactOrder[a.impact] - impactOrder[b.impact];
      });
    } else if (sortOrder === 'impact') {
      return [...list].sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);
    }
    return list;
  };

  const badItems = sortItems(filtered.filter((n) => n.sentiment === 'bad' || n.sentiment === 'neutral'));
  const goodItems = sortItems(filtered.filter((n) => n.sentiment === 'good'));
  const maxRows = Math.max(badItems.length, goodItems.length);
  const visibleRows = Math.min(visibleCount, maxRows);
  const hasMore = visibleCount < maxRows;

  // Mobile: show only selected sentiment
  const mobileItems = mobileSentiment === 'bad' ? badItems : goodItems;
  const mobileVisibleItems = mobileItems.slice(0, visibleCount);
  const mobileHasMore = visibleCount < mobileItems.length;

  if (isLoading) {
    return (
      <div className="px-4">
        {/* Mobile Skeleton */}
        <div className="md:hidden">
          <div className="py-3">
            <div className="h-10 bg-slate-700/30 rounded-lg animate-pulse" />
          </div>
          <div className="flex items-center gap-2 py-3 -mx-4 px-4 bg-[#111722] border-b border-[#222F44]">
            <div className="w-5 h-4 bg-slate-700/50 rounded animate-pulse" />
            <div className="h-5 w-20 bg-slate-700/50 rounded animate-pulse" />
          </div>
          <div className="space-y-3 py-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <NewsCardSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Desktop Skeleton */}
        <div className="hidden md:block">
          <div className="grid grid-cols-2 gap-x-5 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-500/20 rounded animate-pulse" />
              <div className="h-5 w-32 bg-slate-700/50 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-500/20 rounded animate-pulse" />
              <div className="h-5 w-32 bg-slate-700/50 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-3 py-3 -mx-4 px-4 bg-[#111722] border-b border-[#222F44]">
            <div className="w-6 h-5 bg-slate-700/50 rounded animate-pulse" />
            <div className="h-6 w-24 bg-slate-700/50 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3 pt-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <NewsCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4">
      {/* Mobile View: Single column with sentiment toggle */}
      <div className="md:hidden">
        {/* Global Sentiment Toggle - shown once at top */}
        <div className="py-3">
          <MobileSentimentToggle />
        </div>

        {groupedByCountry.map(({ country, name, items: countryItems }) => {
          const countryBad = sortItems(countryItems.filter((n) => n.sentiment === 'bad' || n.sentiment === 'neutral'));
          const countryGood = sortItems(countryItems.filter((n) => n.sentiment === 'good'));
          const countryFiltered = mobileSentiment === 'bad' ? countryBad : countryGood;
          const currentLimit = countryVisibleRows[country] || COUNTRY_INITIAL_ROWS;
          const visibleItems = countryFiltered.slice(0, currentLimit);
          const hasMoreItems = countryFiltered.length > currentLimit;

          if (countryItems.length === 0) return null;

          return (
            <div key={country}>
              {/* Country Header */}
              <div className="flex items-center gap-2 py-3 -mx-4 px-4 bg-[#111722] border-b border-[#222F44]">
                <CountryFlag code={country} size={20} />
                <h2 className="text-base font-bold text-white">{name}</h2>
                <span className="ml-auto text-xs text-white border border-[#222F44] px-2 py-0.5 rounded-full">
                  {countryItems.length}
                </span>
              </div>

              <div className="space-y-3 pb-4 pt-3">
                {visibleItems.length > 0 ? (
                  visibleItems.map((item) => (
                    <NewsCard key={item.id} item={item} />
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-600 text-sm">No {mobileSentiment} sentiment news</div>
                )}
              </div>

              {/* Per-country load more */}
              {hasMoreItems && (
                <div className="flex justify-center pb-4">
                  <button
                    onClick={() => loadMoreCountryRows(country)}
                    className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-[#0D7FF2] border border-[#0D7FF2]/30 rounded-lg hover:bg-[#0D7FF2]/10 transition-colors"
                  >
                    Show more ({countryFiltered.length - currentLimit})
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {groupedByCountry.length === 0 && (
          <div className="text-center py-12 text-slate-600 text-sm">No news matching filters</div>
        )}
      </div>

      {/* Desktop View: Two-column grid */}
      <div className="hidden md:block">
        {/* Global Sentiment column headers - shown once at top */}
        <div className="grid grid-cols-2 gap-x-5 pt-2 pb-3 ">
          <div className="flex items-center gap-2">
            <TrendingDown size={18} className="text-red-400" />
            <h2 className="text-lg font-bold tracking-widest uppercase text-red-400">Bad Sentiment</h2>
            <span className="ml-auto text-xs font-medium text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-full min-w-[2rem] text-center">
              {badItems.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-green-400" />
            <h2 className="text-lg font-bold tracking-widest uppercase text-green-400">Good Sentiment</h2>
            <span className="ml-auto text-xs font-medium text-green-500 bg-green-500/10 border border-green-500/30 px-3 py-1 rounded-full min-w-[2rem] text-center">
              {goodItems.length}
            </span>
          </div>
        </div>

        {groupedByCountry.map(({ country, name, items: countryItems }) => {
          const countryBad = sortItems(countryItems.filter((n) => n.sentiment === 'bad' || n.sentiment === 'neutral'));
          const countryGood = sortItems(countryItems.filter((n) => n.sentiment === 'good'));
          const countryMaxRows = Math.max(countryBad.length, countryGood.length);
          const currentLimit = countryVisibleRows[country] || COUNTRY_INITIAL_ROWS;
          const showRows = Math.min(currentLimit, countryMaxRows);
          const hasMoreRows = countryMaxRows > showRows;

          if (countryMaxRows === 0) return null;

          return (
            <div key={country}>
              {/* Country Header */}
              <div className="flex items-center gap-3 py-3 -mx-4 px-4 bg-[#111722] border-b border-[#222F44]">
                <CountryFlag code={country} size={24} />
                <h2 className="text-lg font-bold text-white">{name}</h2>
                <span className="ml-auto text-sm text-white border border-[#222F44] px-3 py-0.5 rounded-full">
                  {countryItems.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-3 mb-2 pt-3">
                {/* Paired Cards */}
                {Array.from({ length: showRows }).map((_, i) => (
                  <Fragment key={i}>
                    {countryBad[i] ? (
                      <NewsCard item={countryBad[i]} />
                    ) : (
                      <div className="flex items-center justify-center p-6 border-2 border-dashed border-[#1A2332] rounded-xl bg-[#0B1017]/50 h-full min-h-[120px]">
                        <span className="text-sm font-medium tracking-wide text-slate-600">No bad sentiment news</span>
                      </div>
                    )}
                    {countryGood[i] ? (
                      <NewsCard item={countryGood[i]} />
                    ) : (
                      <div className="flex items-center justify-center p-6 border-2 border-dashed border-[#1A2332] rounded-xl bg-[#0B1017]/50 h-full min-h-[120px]">
                        <span className="text-sm font-medium tracking-wide text-slate-600">No good sentiment news</span>
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>

              {/* Per-country load more */}
              {hasMoreRows && (
                <div className="flex justify-center py-3">
                  <button
                    onClick={() => loadMoreCountryRows(country)}
                    className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-[#0D7FF2] border border-[#0D7FF2]/30 rounded-lg hover:bg-[#0D7FF2]/10 transition-colors"
                  >
                    Show more ({countryMaxRows - showRows} more)
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {groupedByCountry.length === 0 && (
          <div className="text-center py-12 text-slate-600 text-sm">No news matching filters</div>
        )}
      </div>
    </div>
  );
}
