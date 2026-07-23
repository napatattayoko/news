import { useState, useEffect, useRef } from 'react';
import { ImpactLevel, DailyStat } from '@/lib/types';

export interface TickerStats {
  id?: string;
  symbol: string;
  impactLevel: ImpactLevel;
  sentiment: 'up' | 'down' | 'flat';
  mentionCount: number;
  score: number;
  sentimentHistorical: { positive: number; negative: number; neutral: number };
  latestNewsDate?: string | null;
  parentStatStartDate?: string | null;
  parentStatStartPrice?: number | null;
  parentStatEndDate?: string | null;
  parentStatEndPrice?: number | null;
  priceTrend?: number[];
  accuracy?: number | null; // 0-100%, null = no price data to compute
  dailyBreakdown?: DailyStat[];
}

// Module-level cache so data survives component unmount/remount (page navigation)
const statsCache = new Map<string, TickerStats[]>();

function getCacheKey(symbols: string[], range: string, statRange: number) {
  return `${symbols.join(',')}_${range}_${statRange}`;
}

export function useTickersStats(symbols: string[], range: '24H' | '7D' | '30D' | 'All' = '24H', statRange: number = 5) {
  const cacheKey = getCacheKey(symbols, range, statRange);
  const cached = statsCache.get(cacheKey);

  // Initialize from cache if available, skip loading skeleton
  const [data, setData] = useState<TickerStats[]>(cached ?? []);
  const [isLoading, setIsLoading] = useState(!cached);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    // If cache exists for this key, hydrate immediately (no flicker)
    const cachedData = statsCache.get(cacheKey);
    if (cachedData) {
      setData(cachedData);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    const fetchStats = async (id: number) => {
      try {
        const queryPart = symbols.length > 0 ? `symbols=${symbols.join(',')}&` : '';
        const res = await fetch(`/api/sentiment?${queryPart}range=${range}&statRange=${statRange}`);
        const result = await res.json();

        // Only apply if this is still the latest request (prevents race condition)
        if (id !== fetchIdRef.current) return;

        if (result.success) {
          setData(result.data);
          statsCache.set(cacheKey, result.data); // Update cache
        } else {
          console.error('[useTickersStats] API Error:', result.error);
        }
      } catch (err) {
        if (id !== fetchIdRef.current) return;
        console.error('[useTickersStats] Network error:', err);
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Increment fetch ID to invalidate any in-flight requests from previous range
    const currentId = ++fetchIdRef.current;
    fetchStats(currentId);

    // Poll every 60 seconds (reduced from 5s — sentiment data changes on bot scrape cycle, not per-second)
    const interval = setInterval(() => {
      const pollId = ++fetchIdRef.current;
      fetchStats(pollId);
    }, 60_000);

    return () => clearInterval(interval);
  }, [symbols.join(','), range, statRange]); // re-run when the list of symbols, range, or statRange changes

  // Map to ensure all requested symbols exist in output, allowing multiple rows per symbol
  if (symbols.length > 0) {
    const resultList: TickerStats[] = [];
    for (const symbol of symbols) {
      const symbolRows = data.filter(d => d.symbol === symbol);
      if (symbolRows.length > 0) {
        resultList.push(...symbolRows);
      } else {
        resultList.push({
          symbol,
          impactLevel: 'low' as ImpactLevel,
          sentiment: 'flat' as const,
          mentionCount: 0,
          score: 5,
          sentimentHistorical: { positive: 0, negative: 0, neutral: 0 },
          latestNewsDate: null
        });
      }
    }
    return { stats: resultList, isLoading };
  }
  
  return { stats: data, isLoading };
}

export function useTickerStats(symbol: string, range: '24H' | '7D' | '30D' | 'All' = '24H', statRange: number = 5) {
  const { stats } = useTickersStats([symbol], range, statRange);
  return stats[0];
}
