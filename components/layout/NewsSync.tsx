'use client';

import { useEffect, useRef } from 'react';
import { useTerminalStore } from '@/lib/store';

export default function NewsSync() {
  const { syncNewsItem } = useTerminalStore();
  const initialLoadDone = useRef(false);

  useEffect(() => {
    let active = true;

    async function sync() {
      try {
        const res = await fetch('/api/news');
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.news)) {
            if (!initialLoadDone.current) {
              // Silently sync already existing news on first load to prevent flooding toasts
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data.news.forEach((item: any) => {
                useTerminalStore.setState((state) => {
                  if (state.news.some((n) => n.id === item.id)) return {};
                  // Make sure dates are properly typed as Date objects if they aren't
                  const formattedItem = {
                    ...item,
                    publishedAt: new Date(item.publishedAt)
                  };
                  return { news: [formattedItem, ...state.news] };
                });
              });
              initialLoadDone.current = true;
            } else {
              // Process new news items with full notification trigger
              const reversed = [...data.news].reverse();
              for (const item of reversed) {
                syncNewsItem({
                  ...item,
                  publishedAt: new Date(item.publishedAt)
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to sync news:', err);
      }
    }

    // Run initially
    sync();

    // Poll every 3 seconds
    const interval = setInterval(sync, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [syncNewsItem]);

  return null;
}
