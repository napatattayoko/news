'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tickerToast } from '@/lib/toast';

interface AddTickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackedTickers: string[];
  onAddTicker: (symbol: string) => void;
}

export default function AddTickerModal({
  isOpen,
  onClose,
  trackedTickers,
  onAddTicker,
}: AddTickerModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');

  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/finviz?action=market')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const combined = [...data.data.gainers, ...data.data.losers];
          const unique = Array.from(new Map(combined.map(item => [item.symbol, item])).values());
          setSuggestions(unique);
        }
      })
      .catch(console.error);
  }, []);

  const availableTickers = useMemo(() => 
    suggestions.filter((item) => !trackedTickers.includes(item.symbol)),
    [suggestions, trackedTickers]
  );

  const filtered = useMemo(() => 
    search.trim()
      ? availableTickers.filter((item) =>
          item.symbol.toLowerCase().includes(search.trim().toLowerCase())
        )
      : availableTickers,
    [search, availableTickers]
  );

  const exactMatch = filtered.find(t => t.symbol.toLowerCase() === search.trim().toLowerCase());
  const showCustomAdd = search.trim().length > 0 && !exactMatch && !trackedTickers.map(t => t.toLowerCase()).includes(search.trim().toLowerCase());

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Reset search when opening (using key to force re-mount)
  const modalKey = isOpen ? 'open' : 'closed';

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      key={modalKey}
      ref={ref}
      className="absolute top-full right-0 mt-2 w-64 bg-[#1A1A1A] border border-[#222F44] rounded-xl shadow-xl z-50 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-[#222F44] flex flex-col gap-2">
        <p className="text-xs text-slate-400 font-medium">Add to Watchlist</p>
        <div className="flex items-center gap-2 bg-[#111722] rounded-lg px-2 py-1.5">
          <Search size={13} className="text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol…"
            className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto pb-2">
        {showCustomAdd && (
          <button
            onClick={() => {
              onAddTicker(search.trim().toUpperCase());
              tickerToast.added(search.trim().toUpperCase(), 'watchlist');
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-[#222F44] bg-[#0D7FF2]/5"
          >
            <div>
              <span className="text-white font-semibold text-sm">
                {search.trim().toUpperCase()}
              </span>
              <p className="text-xs text-[#0D7FF2]">Add custom symbol</p>
            </div>
            <span className="text-xs font-bold text-[#0D7FF2]">+ Add</span>
          </button>
        )}

        {filtered.length === 0 && !showCustomAdd ? (
          <div className="px-3 py-4 text-center text-sm text-slate-500">
            {search.trim() ? 'No matches' : suggestions.length === 0 ? 'Loading suggestions...' : 'No more tickers'}
          </div>
        ) : (
          filtered.map((item) => (
            <button
              key={item.symbol}
              onClick={() => {
                onAddTicker(item.symbol);
                tickerToast.added(item.symbol, 'watchlist');
                onClose();
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors text-left'
              )}
            >
              <div>
                <span className="text-white font-semibold text-sm">
                  {item.symbol}
                </span>
                <p className="text-xs text-slate-500">{item.change || 'N/A'}</p>
              </div>
              <span className="text-xs text-[#0D7FF2]">+ Add</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
