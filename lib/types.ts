// ─── Shared enums ───────────────────────────────────────
export type Region = string;
export type RegionTab = 'global' | 'us' | 'eu' | 'asia' | 'mena';
export type Category =
  | 'all'
  | 'markets'
  | 'economy'
  | 'geopolitics'
  | 'tech'
  | 'ai'
  | 'crypto'
  | 'energy'
  | 'commodities'
  | 'healthcare'
  | 'real-estate'
  | 'climate'
  | 'defense'
  | 'banking'
  | 'automotive'
  | 'trade'
  | 'entertainment';
export type ImpactLevel = 'high' | 'medium' | 'low';
export type Sentiment = 'good' | 'bad' | 'neutral';
export type SortOrder = 'latest' | 'oldest' | 'impact';

// ─── Types ──────────────────────────────────────────────
export interface NewsItem {
  id: string;
  headline: string;
  body: string;
  sources: { name: string; url: string }[];
  publishedAt: string | Date;
  regionTag: RegionTab;
  countryCode: Region;
  category: Category;
  impact: ImpactLevel;
  sentiment: Sentiment;
  tickers: { symbol: string; name: string; sentiment: 'up' | 'down' | 'flat'; sentimentScore: number }[];
  narrativeGroupId?: string;
  logoUrl?: string;
  imageUrl?: string;
}

export interface SentimentHistorical {
  positive: number;
  negative: number;
  neutral: number;
}

// Unified ticker analysis — matches GET /tickers/analysis response
export interface TickerAnalysis {
  symbol: string;
  name: string;
  impactLevel: ImpactLevel;
  sentiment: 'up' | 'down' | 'flat';
  mentionCount: number;
  sentimentHistorical: SentimentHistorical;
  score: number;
  accuracy?: number | null; // 0-100%, null = no price data to compute
}

export interface DailyStat {
  date: string;
  sentiment: 'up' | 'down' | 'flat';
  impactLevel: ImpactLevel;
  score: number;
  mentionCount: number;
  sentimentHistorical: SentimentHistorical;
  accuracy?: number | null;
  endDate?: string | null;
  startPrice?: number;
  endPrice?: number;
}

export interface LiveUpdate {
  headline: string;
  shortHeadline: string;
  publishedAt: string | Date;
}

export interface NarrativeGroup {
  id: string;
  masterHeadline: string;
  items: NewsItem[];
}

export type TrendFilter = 'all' | 'top_positive' | 'top_negative' | 'most_mention';

// Telegram notification status for watchlist
export interface TelegramNotificationStatus {
  symbol: string;
  status: 'SENT' | 'FAILED' | 'PROCESSING';
  timestamp: string | Date;
}

export interface AppNotification {
  id: string;
  newsId: string;
  headline: string;
  impact: ImpactLevel;
  sentiment: Sentiment;
  tickers: string[];
  publishedAt: string | Date;
  read: boolean;
  type: 'high-impact' | 'watchlist' | 'both';
}
