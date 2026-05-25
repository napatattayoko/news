'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Rss, TrendingUp, Star, Settings, Hash, X, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import LiveUpdateWidget from './LiveUpdateWidget';
import ImpactProCard from '@/components/widgets/ImpactProCard';
import TickerCloud from '@/components/tickers/TickerCloud';
import { useTerminalStore } from '@/lib/store';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/stock-sentiment', label: 'Stock Sentiment', icon: Rss },
  { href: '/market-trends', label: 'Trending', icon: TrendingUp },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, userPlan } = useTerminalStore();

  const isAuthPage = pathname === '/login' || pathname === '/register';
  if (isAuthPage) return null;

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Mobile Sidebar - slides from right with widget content */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 right-0 h-full w-72 z-40 transition-all duration-300',
          'flex flex-col bg-[#0F1924] border-l border-[#222F44]',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="px-5 pt-6 pb-5 flex items-center justify-between">
          <span className="text-lg font-semibold text-white">Sidebar</span>
          <button
            onClick={toggleSidebar}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Widget Content */}
        <div className="flex-1 px-4 py-2 space-y-4 overflow-y-auto">
          <ImpactProCard />
          <TickerCloud />
          <LiveUpdateWidget />
        </div>
      </aside>

      {/* Desktop Sidebar - left side with navigation */}
      <aside
        className={cn(
          'hidden lg:flex flex-col min-h-screen bg-[#0F1924] border-r border-[#222F44] shrink-0 z-40',
          'lg:relative lg:w-64'
        )}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold tracking-wider text-[#0D7FF2] uppercase">
              IMPACT TERMINAL
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-150 text-white',
                  active
                    ? 'bg-white/10'
                    : 'hover:bg-white/5'
                )}
              >
                <Icon size={18} className="text-white" strokeWidth={2} />
                {label}
                {href === '/watchlist' && userPlan === 'free' && (
                  <Lock size={14} className="ml-auto text-[#808080]" />
                )}
              </Link>
            );
          })}

          {/* Live Update - directly under Watchlist */}
          <div className="pt-6">
            <LiveUpdateWidget />
          </div>
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-[#222F44]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#2A2A2A] flex items-center justify-center">
                <Hash size={14} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Elon Musk</div>
                <div className="text-xs text-[#808080]">Free Plan</div>
              </div>
            </div>
            <button className="text-white hover:text-slate-300 transition-colors">
              <Settings size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
