'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Bell, Menu, X, ArrowLeft } from 'lucide-react';
import { useTerminalStore } from '@/lib/store';
import SearchOverlay from '@/components/search/SearchOverlay';
import NotificationDropdown from './NotificationDropdown';
import FinvizMarquee from '@/components/tickers/FinvizMarquee';

const DETAIL_PAGE_PATTERNS = [
  /^\/stock-sentiment\/.+/,
  /^\/ticker\/.+/,
];

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const showBack = DETAIL_PAGE_PATTERNS.some((p) => p.test(pathname));
  const { toggleSidebar, searchOverlayOpen, openSearchOverlay, selectedSymbols, removeSymbol, clearSymbols, unreadNotificationCount } = useTerminalStore();
  const [notificationOpen, setNotificationOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-20 bg-[#0a1017] backdrop-blur-md border-b border-[#222F44] px-4 py-3">
        {/* Mobile Header - branding left, hamburger right */}
        <div className="flex items-center justify-between mb-3 md:hidden">
          <span className="text-xl font-extrabold tracking-wider text-[#0D7FF2]">
            Impact Terminal
          </span>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-white/8 transition-colors text-slate-400 hover:text-slate-200"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Back button — visible on detail pages */}
          {showBack && (
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-white/8 transition-colors text-slate-400 hover:text-slate-200"
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          {/* Hamburger — visible on desktop (lg:hidden hides it, but we show on md-lg) */}
          <button
            onClick={toggleSidebar}
            className="hidden md:block lg:hidden p-2 rounded-lg hover:bg-white/8 transition-colors text-slate-400 hover:text-slate-200"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          {/* Search trigger — opens overlay on click/focus */}
          <div
            id="topbar-search-trigger"
            role="button"
            tabIndex={0}
            onClick={openSearchOverlay}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openSearchOverlay(); }}
            className="relative flex-1 flex items-center gap-2 bg-[#111722] hover:bg-[#171f2e] rounded-lg px-3 py-2 text-sm text-slate-500 transition-all cursor-text text-left group"
            aria-label="Open search"
          >
            <Search size={15} className="text-slate-400 shrink-0 group-hover:text-slate-300 transition-colors" />
            {selectedSymbols.length > 0 ? (
              <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                {selectedSymbols.map((sym) => (
                  <span
                    key={sym}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2962FF]/15 text-[#2962FF] text-[12px] font-semibold"
                  >
                    {sym}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeSymbol(sym); }}
                      className="hover:text-white transition-colors"
                      aria-label={`Remove ${sym}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span className="flex-1 text-sm text-slate-500 group-hover:text-slate-400 transition-colors">
                Search symbols or news…
              </span>
            )}
            {selectedSymbols.length > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); clearSymbols(); }}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded border border-white/10 hover:border-white/20 transition-colors"
                aria-label="Clear all symbols"
              >
                Clear
              </button>
            )}
          </div>

          {/* Bell */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setNotificationOpen(!notificationOpen); }}
              className="relative p-2 rounded-lg bg-[#111722] hover:bg-[#1C2635] transition-colors text-white flex items-center justify-center border border-white/5 hover:border-white/10"
              aria-label="Notifications"
            >
              <Bell size={17} />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold border border-[#0a1017]">
                  {unreadNotificationCount}
                </span>
              )}
            </button>
            <NotificationDropdown
              isOpen={notificationOpen}
              onClose={() => setNotificationOpen(false)}
            />
          </div>
        </div>
      </div>
      
      {/* Real-time Finviz Stock Marquee */}
      <FinvizMarquee />

      {/* Search Overlay — portal-style, rendered at top level */}
      {searchOverlayOpen && <SearchOverlay />}
    </>
  );
}
