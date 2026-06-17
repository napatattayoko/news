'use client';

import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PremiumLockProps {
  featureName?: string;
}

export default function PremiumLock({ featureName = 'Watchlist' }: PremiumLockProps) {
  const router = useRouter();

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a1017]">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
        <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-[#222F44] flex items-center justify-center">
          <Lock size={28} className="text-[#0D7FF2]" />
        </div>
        <h2 className="text-xl font-bold text-white">
          {featureName} is a Premium Feature
        </h2>
        <p className="text-sm text-[#808080] leading-relaxed">
          Upgrade to Premium to unlock {featureName}, real-time alerts, and more advanced tools.
        </p>
        <button 
          onClick={() => router.push('/subscription')}
          className="mt-2 px-6 py-2.5 bg-[#0D7FF2] hover:bg-[#0B6BD4] text-white text-sm font-bold rounded-lg transition-colors"
        >
          Upgrade to Premium
        </button>
      </div>
    </div>
  );
}
