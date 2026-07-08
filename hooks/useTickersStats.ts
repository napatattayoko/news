import { useState, useEffect, useRef } from 'react';
import { ImpactLevel } from '@/lib/types';

export interface TickerStats {
  symbol: string;
  impactLevel: ImpactLevel;
  sentiment: 'up' | 'down' | 'flat';
  mentionCount: number;
  score: number;
  sentimentHistorical: { positive: number; negative: number; neutral: number };
  latestNewsDate?: string | null;
}

export function useTickersStats(symbols: string[], range: '24H' | '7D' | '30D' | 'All' = '24H') {
  const [data, setData] = useState<TickerStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    isInitialLoad.current = true;

    const fetchStats = async () => {
      // Only set loading to true on initial fetch, not during background polling
      if (isInitialLoad.current) {
        setIsLoading(true);
      }
      try {
        const queryPart = symbols.length > 0 ? `symbols=${symbols.join(',')}&` : '';
        const res = await fetch(`/api/sentiment?${queryPart}range=${range}`);
        const result = await res.json();

        if (result.success) {
          setData(result.data);
          isInitialLoad.current = false; // Mark initial load complete on success
        } else {
          console.error('[useTickersStats] API Error:', result.error);
        }
      } catch (err) {
        console.error('[useTickersStats] Network error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();

    // Poll every 5 seconds to keep the stats real-time
    const interval = setInterval(fetchStats, 5000);

    return () => clearInterval(interval);
  }, [symbols.join(','), range]); // re-run when the list of symbols or selected range changes

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

export function useTickerStats(symbol: string, range: '24H' | '7D' | '30D' | 'All' = '24H') {
  const { stats } = useTickersStats([symbol], range);
  return stats[0];
}
