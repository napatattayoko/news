import { useState, useEffect } from 'react';
import { ImpactLevel } from '@/lib/types';
import { mockStockSentiment } from '@/lib/api';

export interface TickerStats {
  symbol: string;
  impactLevel: ImpactLevel;
  sentiment: 'up' | 'down' | 'flat';
  mentionCount: number;
  score: number;
  sentimentHistorical: { positive: number; negative: number; neutral: number };
}

export function useTickersStats(symbols: string[]) {
  const [data, setData] = useState<TickerStats[]>([]);
  
  useEffect(() => {
    if (symbols.length === 0) {
      setData([]);
      return;
    }

    const fetchStats = async () => {
      try {
        const query = symbols.join(',');
        const res = await fetch(`/api/sentiment?symbols=${query}`);
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
  }, [symbols.join(',')]); // re-run only when the actual list of symbols changes

  // Map to ensure all requested symbols exist in output, with fallback mockup data while loading
  return symbols.map(symbol => {
    const fetched = data.find(d => d.symbol === symbol);
    if (fetched) return fetched;
    
    // Fallback while loading or if it failed
    const mock = mockStockSentiment.find(m => m.symbol === symbol);
    return mock || {
      symbol,
      impactLevel: 'low' as ImpactLevel,
      sentiment: 'flat' as const,
      mentionCount: 0,
      score: 5,
      sentimentHistorical: { positive: 0, negative: 0, neutral: 0 }
    };
  });
}

export function useTickerStats(symbol: string) {
  const stats = useTickersStats([symbol]);
  return stats[0];
}
