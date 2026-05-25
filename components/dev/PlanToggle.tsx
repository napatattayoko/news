'use client';

import { useTerminalStore } from '@/lib/store';
import { usePathname } from 'next/navigation';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PlanToggle() {
  const pathname = usePathname();
  const { userPlan, setUserPlan } = useTerminalStore();
  const isPremium = userPlan === 'premium';

  const isAuthPage = pathname === '/login' || pathname === '/register';
  if (isAuthPage) return null;

  return (
    <button
      onClick={() => setUserPlan(isPremium ? 'free' : 'premium')}
      className={cn(
        'fixed bottom-4 right-4 z-50 hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-colors',
        isPremium
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
          : 'bg-[#1A1A1A] border-[#222F44] text-[#808080] hover:bg-[#2A2A2A]'
      )}
    >
      <Crown size={14} />
      {isPremium ? 'Premium' : 'Free'}
    </button>
  );
}
