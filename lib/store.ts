'use client';

import { create } from 'zustand';
import { RegionTab, Region, ImpactLevel, SortOrder, Category, NewsItem, AppNotification } from './types';
import { mockNews } from './mock-data';
import { toast } from './toast';

interface TerminalStore {
  activeRegion: RegionTab;
  activeCountry: Region | 'all';
  activeCategory: Category;
  activeTicker: string | null;
  activeImpact: ImpactLevel | 'all';
  sortOrder: SortOrder;
  sidebarOpen: boolean;
  selectedSymbols: string[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchOverlayOpen: boolean;
  trackedTickers: string[];
  sentimentTickers: string[];
  sentimentTickerOrder: string[];
  telegramConnected: boolean;
  userPlan: 'free' | 'premium';
  mobileSentiment: 'bad' | 'good';
  setUserPlan: (plan: 'free' | 'premium') => void;
  setMobileSentiment: (sentiment: 'bad' | 'good') => void;
  setRegion: (region: RegionTab) => void;
  setCountry: (country: Region | 'all') => void;
  setCategory: (category: Category) => void;
  setTicker: (ticker: string | null) => void;
  setImpact: (impact: ImpactLevel | 'all') => void;
  setSortOrder: (order: SortOrder) => void;
  toggleSidebar: () => void;
  addTicker: (symbol: string) => void;
  removeTicker: (symbol: string) => void;
  addSentimentTicker: (symbol: string) => void;
  removeSentimentTicker: (symbol: string) => void;
  setSentimentTickerOrder: (order: string[]) => void;
  toggleSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
  clearSymbols: () => void;
  scrollToNewsId: string | null;
  setScrollToNewsId: (id: string | null) => void;
  openSearchOverlay: () => void;
  closeSearchOverlay: () => void;
  connectTelegram: () => void;
  disconnectTelegram: () => void;
  news: NewsItem[];
  notifications: AppNotification[];
  unreadNotificationCount: number;
  setNews: (news: NewsItem[]) => void;
  addNewsItem: (item: NewsItem) => void;
  markAllNotificationsAsRead: () => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  activeRegion: 'global',
  activeCountry: 'all',
  activeCategory: 'all',
  activeTicker: null,
  activeImpact: 'all',
  sortOrder: 'latest',
  sidebarOpen: false,
  setRegion: (region) => set({ activeRegion: region, activeCountry: 'all', activeTicker: null }),
  setCountry: (country) => set({ activeCountry: country }),
  setCategory: (category) => set({ activeCategory: category }),
  setTicker: (ticker) => set((state) => ({
    activeTicker: state.activeTicker === ticker ? null : ticker,
  })),
  setImpact: (impact) => set({ activeImpact: impact }),
  setSortOrder: (order) => set({ sortOrder: order }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  selectedSymbols: [],
  toggleSymbol: (symbol) => set((state) => ({
    selectedSymbols: state.selectedSymbols.includes(symbol)
      ? state.selectedSymbols.filter((s) => s !== symbol)
      : [...state.selectedSymbols, symbol],
  })),
  removeSymbol: (symbol) => set((state) => ({
    selectedSymbols: state.selectedSymbols.filter((s) => s !== symbol),
  })),
  clearSymbols: () => set({ selectedSymbols: [] }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  scrollToNewsId: null,
  setScrollToNewsId: (id) => set({ scrollToNewsId: id }),
  searchOverlayOpen: false,
  openSearchOverlay: () => set({ searchOverlayOpen: true }),
  closeSearchOverlay: () => set({ searchOverlayOpen: false }),
  telegramConnected: false,
  userPlan: 'free',
  setUserPlan: (plan) => set({ userPlan: plan }),
  mobileSentiment: 'bad',
  setMobileSentiment: (sentiment) => set({ mobileSentiment: sentiment }),
  connectTelegram: () => set({ telegramConnected: true }),
  disconnectTelegram: () => set({ telegramConnected: false }),
  trackedTickers: ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'NVDA'],
  addTicker: (symbol) => set((state) => {
    if (!state.trackedTickers.includes(symbol)) {
      fetch('/api/telegram/notify-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: symbol }),
      }).catch((err) => console.error('Failed to send add ticker notification:', err));

      return {
        trackedTickers: [...state.trackedTickers, symbol],
      };
    }
    return {};
  }),
  removeTicker: (symbol) => set((state) => {
    fetch('/api/telegram/notify-remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: symbol }),
    }).catch((err) => console.error('Failed to send remove ticker notification:', err));

    return {
      trackedTickers: state.trackedTickers.filter((t) => t !== symbol),
    };
  }),
  sentimentTickers: [],
  sentimentTickerOrder: [],
  addSentimentTicker: (symbol) => set((state) => ({
    sentimentTickers: state.sentimentTickers.includes(symbol) ? state.sentimentTickers : [...state.sentimentTickers, symbol],
    sentimentTickerOrder: state.sentimentTickers.includes(symbol) ? state.sentimentTickerOrder : [...state.sentimentTickerOrder, symbol],
  })),
  removeSentimentTicker: (symbol) => set((state) => ({
    sentimentTickers: state.sentimentTickers.filter((t) => t !== symbol),
    sentimentTickerOrder: state.sentimentTickerOrder.filter((t) => t !== symbol),
  })),
  setSentimentTickerOrder: (order) => set({ sentimentTickerOrder: order }),
  news: [],
  notifications: [],
  unreadNotificationCount: 0,
  setNews: (news) => set((state) => {
    const historicalNotifications: AppNotification[] = [];

    news.forEach(item => {
      const isWatchlist = item.tickers.some(t => state.trackedTickers.includes(t.symbol.toUpperCase()));
      const isHighImpact = item.impact === 'high';

      if (isWatchlist || isHighImpact) {
        const type = isWatchlist && isHighImpact ? 'both' : isHighImpact ? 'high-impact' : 'watchlist';

        historicalNotifications.push({
          id: `notif-hist-${item.id}`,
          newsId: item.id,
          headline: item.headline,
          impact: item.impact,
          sentiment: item.sentiment,
          tickers: item.tickers.map(t => t.symbol),
          publishedAt: new Date(item.publishedAt),
          read: true, // Mark as read so it acts as history without annoying unread counters
          type
        });
      }
    });

    historicalNotifications.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return {
      news,
      notifications: historicalNotifications
    };
  }),
  addNewsItem: (item) => set((state) => {
    const updatedNews = [item, ...state.news];

    // Check if item contains any ticker in watchlist
    const isWatchlist = item.tickers.some(t => state.trackedTickers.includes(t.symbol.toUpperCase()));
    const isHighImpact = item.impact === 'high';
    const shouldNotify = isWatchlist || isHighImpact;

    // Send the news update to the Telegram Bot API so users receive it at the exact same time
    fetch('/api/telegram/mock-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headline: item.headline,
        messageBody: item.body,
        tickers: item.tickers.map(t => t.symbol),
        sentiment: item.sentiment,
        impact: item.impact
      }),
    }).catch((err) => console.error('Failed to trigger Telegram notification:', err));

    if (shouldNotify) {
      const type = isWatchlist && isHighImpact ? 'both' : isHighImpact ? 'high-impact' : 'watchlist';
      const notificationId = `notif-${Date.now()}-${item.id}`;

      const newNotif: AppNotification = {
        id: notificationId,
        newsId: item.id,
        headline: item.headline,
        impact: item.impact,
        sentiment: item.sentiment,
        tickers: item.tickers.map(t => t.symbol),
        publishedAt: new Date(),
        read: false,
        type
      };

      const title = type === 'both'
        ? '🔥 High Impact Watchlist Alert'
        : type === 'high-impact'
          ? '⚡ High Impact News Alert'
          : '🔔 Watchlist News Alert';

      const tickerText = item.tickers.map(t => `$${t.symbol}`).join(', ');
      const desc = tickerText ? `[${tickerText}] ${item.headline}` : item.headline;

      toast.info(title, desc);

      return {
        news: updatedNews,
        notifications: [newNotif, ...state.notifications],
        unreadNotificationCount: state.unreadNotificationCount + 1
      };
    }

    return {
      news: updatedNews
    };
  }),
  markAllNotificationsAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true })),
    unreadNotificationCount: 0
  })),
  markNotificationAsRead: (id) => set((state) => {
    const notifications = state.notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    const unreadNotificationCount = notifications.filter(n => !n.read).length;
    return { notifications, unreadNotificationCount };
  }),
  clearNotifications: () => set({
    notifications: [],
    unreadNotificationCount: 0
  }),
}));
