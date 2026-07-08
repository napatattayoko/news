'use client';

import { TrendingUp } from 'lucide-react';

export default function MarketTrendsPlaceholderPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#0a1017] min-h-[80vh]">
      <div className="p-4 bg-[#111722] border border-[#222F44] rounded-full mb-4 animate-bounce">
        <TrendingUp size={48} className="text-[#0D7FF2]" />
      </div>
      <h1 className="text-2xl font-extrabold text-white uppercase tracking-wider mb-2">
        Trending Page
      </h1>
      <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
        Exciting new real-time market data analytics and visualizers are coming soon! Stay tuned.
      </p>
    </div>
  );
}
