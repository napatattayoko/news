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
        const limit = initialLoadDone.current ? 20 : 2000;
        const res = await fetch(`/api/finviz?action=news&limit=${limit}`);
        if (!active) return;
        if (res.ok) {
          const responseBody = await res.json();
          if (responseBody.success && Array.isArray(responseBody.data)) {
            if (!initialLoadDone.current) {
              // Silently sync already existing news on first load to prevent flooding toasts
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const formattedItems = responseBody.data.map((item: any) => ({
                ...item,
                publishedAt: new Date(item.publishedAt)
              }));
              useTerminalStore.setState((state) => {
                const existingIds = new Set(state.news.map(n => n.id));
                const newItems = formattedItems.filter((n: any) => !existingIds.has(n.id));
                // API returns in descending order (newest first). 
                // We prepend newItems to state.news. Wait, if we prepend the array,
                // we want the newest items at the start, so we just spread them.
                return { news: [...newItems, ...state.news] };
              });
              initialLoadDone.current = true;
            } else {
              // Process new news items with full notification trigger
              const reversed = [...responseBody.data].reverse();
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
