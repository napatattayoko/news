'use client';

import { useRef, useEffect } from 'react';
import RegionRibbon from '@/components/filters/RegionRibbon';
import MobileFilterRow from '@/components/filters/MobileFilterRow';
import ImpactFeed from '@/components/news/ImpactFeed';
import BreakingNews from '@/components/news/BreakingNews';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useTerminalStore } from '@/lib/store';
import { toast } from '@/lib/toast';

export default function DashboardPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const setNews = useTerminalStore((s) => s.setNews);

  useEffect(() => {
    async function loadRealNews() {
      try {
        const res = await fetch('/api/finviz');
        if (!res.ok) throw new Error('Failed to fetch real-time news');
        const data = await res.json();

        if (data.success && data.news) {
          setNews(data.news);
          toast.success(
            'Live News Synced',
            `Successfully loaded ${data.count} real-time market-moving news headlines from Finviz.`
          );
        }
      } catch (err) {
        console.error('Error loading real news:', err);
        toast.error('Sync Failed', 'Could not sync real-time news from Finviz. Using fallback data.');
      }
    }

    loadRealNews();
  }, [setNews]);

  return (
    <>
      <ErrorBoundary>
        <MobileFilterRow />
      </ErrorBoundary>
      <ErrorBoundary>
        <RegionRibbon />
      </ErrorBoundary>
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-28 lg:pb-0">
        <ErrorBoundary>
          <BreakingNews />
        </ErrorBoundary>
        <ErrorBoundary>
          <ImpactFeed />
        </ErrorBoundary>
      </div>
      <ScrollToTopButton scrollContainerRef={scrollRef} />
    </>
  );
}

