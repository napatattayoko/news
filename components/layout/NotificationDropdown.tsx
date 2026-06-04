'use client';

import React, { useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTerminalStore } from '@/lib/store';
import { timeAgo } from '@/lib/utils';
import { Zap, Bell, Check, Trash2, X } from 'lucide-react';
import { AppNotification } from '@/lib/types';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,
    setScrollToNewsId,
  } = useTerminalStore();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      console.log("[DEBUG] handleClickOutside target:", event.target);
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        console.log("[DEBUG] handleClickOutside CLOSING dropdown");
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNotificationClick = (n: AppNotification) => {
    // Mark as read
    markNotificationAsRead(n.id);
    
    // Navigate to dashboard if not already there, and set the news ID to scroll to
    if (pathname !== '/') {
      router.push('/');
    }
    setScrollToNewsId(n.newsId);
    onClose();
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-12 w-80 md:w-96 bg-[#111722] border border-[#222F44] rounded-xl shadow-2xl z-50 overflow-hidden text-slate-200 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#222F44] bg-[#0d131d]">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-[#0D7FF2]" />
          <span className="font-bold text-sm text-white uppercase tracking-wider">News Alerts</span>
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {notifications.filter(n => !n.read).length} New
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {notifications.length > 0 && (
            <>
              <button
                onClick={markAllNotificationsAsRead}
                className="text-[11px] font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                title="Mark all as read"
              >
                <Check size={12} />
                Read All
              </button>
              <button
                onClick={clearNotifications}
                className="text-[11px] font-semibold text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                title="Clear all notifications"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-white/5 transition-colors md:hidden"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto divide-y divide-[#1f2a3c]">
        {notifications.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
            <Bell size={24} className="opacity-30" />
            <p>No new alerts</p>
            <p className="text-[11px] text-slate-600 px-6">
              Notifications trigger for High Impact news or tickers on your Watchlist.
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const isUnread = !n.read;
            const isHighImpact = n.impact === 'high';
            const isWatchlist = n.type === 'watchlist' || n.type === 'both';

            return (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`relative flex gap-3 p-3.5 hover:bg-[#1a2434] transition-all cursor-pointer group ${
                  isUnread ? 'bg-[#152030]/80' : ''
                }`}
              >
                {/* Unread Left Border Highlight */}
                {isUnread && (
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#0D7FF2]" />
                )}

                {/* Icon Wrapper */}
                <div className="shrink-0 pt-0.5">
                  {isHighImpact ? (
                    <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                      <Zap size={14} className="text-red-400 animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                      <Bell size={14} className="text-blue-400" />
                    </div>
                  )}
                </div>

                {/* Text Content */}
                <div className="flex-1 flex flex-col gap-1 pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Badge */}
                    {isHighImpact && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                        High Impact
                      </span>
                    )}
                    {isWatchlist && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        Watchlist
                      </span>
                    )}

                    {/* Tickers */}
                    {n.tickers.map((t) => (
                      <span
                        key={t}
                        className="text-[9px] font-extrabold px-1 rounded bg-[#2962FF]/15 text-[#427cff]"
                      >
                        ${t}
                      </span>
                    ))}
                  </div>

                  <p className={`text-xs leading-normal leading-relaxed ${isUnread ? 'text-white font-medium' : 'text-slate-300'}`}>
                    {n.headline}
                  </p>

                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                    <span>{timeAgo(n.publishedAt)}</span>
                  </div>
                </div>

                {/* Unread circle */}
                {isUnread && (
                  <div className="shrink-0 flex items-center justify-center pt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0D7FF2]" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
