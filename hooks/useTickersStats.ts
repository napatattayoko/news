import { useState, useEffect } from 'react';
import { ImpactLevel } from '@/lib/types';

export interface TickerStats {
  symbol: string;
  impactLevel: ImpactLevel;
  sentiment: 'up' | 'down' | 'flat';
  mentionCount: number;
  score: number;
  sentimentHistorical: { positive: number; negative: number; neutral: number };
}

export function useTickersStats(symbols: string[], range: '24H' | '7D' | '30D' | 'All' = '24H') {
  const [data, setData] = useState<TickerStats[]>([]);
  
  useEffect(() => {
    if (symbols.length === 0) {
      setData([]);
      return;
    }

    const fetchStats = async () => {
      try {
        const query = symbols.join(',');
        const res = await fetch(`/api/sentiment?symbols=${query}&range=${range}`);
        const result = await res.json();
        
        if (result.success) {
          setData(result.data);
        } else {
          console.error('[useTickersStats] API Error:', result.error);
        }
      } catch (err) {
        console.error('[useTickersStats] Network error:', err);
      }
    };

    fetchStats();
  }, [symbols.join(','), range]); // re-run when the list of symbols or selected range changes

  // Map to ensure all requested symbols exist in output, with default empty stats while loading
  return symbols.map(symbol => {
    const fetched = data.find(d => d.symbol === symbol);
    if (fetched) return fetched;
    
    return {
      symbol,
      impactLevel: 'low' as ImpactLevel,
      sentiment: 'flat' as const,
      mentionCount: 0,
      score: 5,
      sentimentHistorical: { positive: 0, negative: 0, neutral: 0 }
    };
  });
}

export function useTickerStats(symbol: string, range: '24H' | '7D' | '30D' | 'All' = '24H') {
  const stats = useTickersStats([symbol], range);
  return stats[0];
}
