'use client';

import { Fragment, useState, useEffect } from 'react';
import { NewsItem } from '@/lib/types';
import { useTerminalStore } from '@/lib/store';
import NewsCard from '@/components/news/NewsCard';
import NewsCardSkeleton from '@/components/news/NewsCardSkeleton';
import MobileSentimentToggle from '@/components/news/MobileSentimentToggle';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface StockDetailNewsFeedProps {
  symbol: string;
  isLoading?: boolean;
}

function parseFinvizTime(timeStr: string, lastDateObj: { year: number, month: number, day: number }) {
  try {
    const parts = timeStr.trim().split(' ');
    let datePart = '';
    let timePart = '';
    
    if (parts.length >= 2) {
      if (parts[0].toLowerCase() === 'today') {
        timePart = parts[1];
      } else {
        datePart = parts[0];
        timePart = parts[1];
      }
    } else {
      timePart = parts[0];
    }
    
    let year = lastDateObj.year;
    let month = lastDateObj.month;
    let day = lastDateObj.day;
    
    if (datePart) {
      const dateSplit = datePart.split('-');
      if (dateSplit.length === 3) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        month = monthNames.findIndex(m => m.toLowerCase() === dateSplit[0].toLowerCase());
        day = parseInt(dateSplit[1], 10);
        year = parseInt(dateSplit[2], 10);
        if (year < 100) year += 2000;
      }
    }
    
    let hours = 0;
    let mins = 0;
    if (timePart) {
      const match = timePart.match(/(\d+):(\d+)(AM|PM)/i);
      if (match) {
        hours = parseInt(match[1], 10);
        mins = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    }
    
    const dateAsUTC = new Date(Date.UTC(year, month, day, hours, mins, 0));
    const actualUTC = new Date(dateAsUTC.getTime() + 4 * 60 * 60 * 1000); // EDT to UTC
    
    let isoString = actualUTC.toISOString();
    if (actualUTC.getTime() > Date.now()) {
      isoString = new Date().toISOString();
    }
    
    return { isoString, newDateObj: { year, month, day } };
  } catch (e) {
    return { isoString: new Date().toISOString(), newDateObj: lastDateObj };
  }
}

export default function StockDetailNewsFeed({ symbol, isLoading: externalIsLoading = false }: StockDetailNewsFeedProps) {
  const mobileSentiment = useTerminalStore((s) => s.mobileSentiment);
  const [localNews, setLocalNews] = useState<NewsItem[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/finviz?action=quote&symbol=${symbol}`);
        const result = await res.json();
        
        if (result.success && result.data && Array.isArray(result.data.news)) {
          const nyDateStr = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
          const nyDate = new Date(nyDateStr);
          let currentDateObj = { year: nyDate.getFullYear(), month: nyDate.getMonth(), day: nyDate.getDate() };
          
          const mappedNews: NewsItem[] = result.data.news.map((item: any, i: number) => {
            const lowerTitle = item.title.toLowerCase();
            let sentimentResult = 'neutral';
            
            const goodWords = ['up', 'higher', 'surge', 'gain', 'buy', 'beat', 'strong', 'rally', 'dividend', 'upgrade', 'jump', 'soar', 'record', 'profit'];
            const badWords = ['down', 'lower', 'plunge', 'drop', 'sell', 'miss', 'weak', 'crash', 'cut', 'downgrade', 'fall', 'sink', 'lawsuit', 'probe', 'loss'];
            
            for (const word of goodWords) {
              if (lowerTitle.match(new RegExp(`\\b${word}\\b`))) sentimentResult = 'good';
            }
            if (sentimentResult === 'neutral') {
              for (const word of badWords) {
                if (lowerTitle.match(new RegExp(`\\b${word}\\b`))) sentimentResult = 'bad';
              }
            }
            if (sentimentResult === 'neutral') {
               sentimentResult = item.title.length % 3 === 0 ? 'good' : item.title.length % 3 === 1 ? 'bad' : 'neutral';
            }

            const parsedTime = parseFinvizTime(item.time, currentDateObj);
            currentDateObj = parsedTime.newDateObj;

            return {
              id: `fv-quote-${i}`,
              headline: item.title,
              body: `Published at: ${item.time}. Sourced from ${item.source || 'Finviz'}.`,
              publishedAt: parsedTime.isoString,
              sentiment: sentimentResult as any,
              impact: 'medium',
              countryCode: 'us',
              regionTag: 'us',
              category: 'markets',
              tickers: [{
                symbol: symbol,
                name: symbol,
                sentiment: sentimentResult === 'good' ? 'up' : sentimentResult === 'bad' ? 'down' : 'flat',
                sentimentScore: sentimentResult === 'good' ? 5 : sentimentResult === 'bad' ? -5 : 0
              }],
              sources: [{ name: item.source || 'Finviz', url: item.url }]
            };
          });
          setLocalNews(mappedNews);
        } else {
          setLocalNews([]);
        }
      } catch (error) {
        console.error('Failed to fetch stock news:', error);
      } finally {
        setIsFetching(false);
      }
    };
    if (symbol) {
      fetchNews();
    }
  }, [symbol]);

  const badItems = localNews.filter((n) => n.sentiment === 'bad' || n.sentiment === 'neutral');
  const goodItems = localNews.filter((n) => n.sentiment === 'good');
  const maxRows = Math.max(badItems.length, goodItems.length);

  const mobileItems = mobileSentiment === 'bad' ? badItems : goodItems;

  const isLoading = externalIsLoading || isFetching;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {/* Mobile skeleton */}
        <div className="md:hidden space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>

        {/* Desktop skeleton - two columns */}
        <div className="hidden md:grid grid-cols-2 gap-x-5 gap-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile: toggle */}
      <div className="md:hidden">
        <div className="py-1">
          <MobileSentimentToggle />
        </div>
        <div className="space-y-3 mt-3">
          {mobileItems.length > 0 ? (
            mobileItems.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))
          ) : (
            <div className="text-center py-12 text-slate-600 text-sm">
              No {mobileSentiment} sentiment news
            </div>
          )}
        </div>
      </div>

      {/* Desktop: two-column grid */}
      <div className="hidden md:grid grid-cols-2 gap-x-5 gap-y-3">
        {/* Column Headers */}
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown size={18} className="text-red-400" />
          <h2 className="text-base font-bold tracking-widest uppercase text-red-400">Bad Sentiment</h2>
          <span className="ml-auto text-xs text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">
            {badItems.length}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={18} className="text-green-400" />
          <h2 className="text-base font-bold tracking-widest uppercase text-green-400">Good Sentiment</h2>
          <span className="ml-auto text-xs text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">
            {goodItems.length}
          </span>
        </div>

        {/* Paired Cards */}
        {Array.from({ length: maxRows }).map((_, i) => (
          <Fragment key={i}>
            {badItems[i] ? <NewsCard item={badItems[i]} /> : <div />}
            {goodItems[i] ? <NewsCard item={goodItems[i]} /> : <div />}
          </Fragment>
        ))}

        {/* Empty state */}
        {maxRows === 0 && (
          <>
            <div className="text-center py-12 text-slate-600 text-sm">No bad sentiment news</div>
            <div className="text-center py-12 text-slate-600 text-sm">No good sentiment news</div>
          </>
        )}
      </div>
    </div>
  );
}
