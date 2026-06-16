'use client';

import { SubscriptionCheckout } from '@/components/subscription/SubscriptionCheckout';

interface PremiumLockProps {
  featureName?: string;
}

export default function PremiumLock({ featureName = 'Watchlist' }: PremiumLockProps) {
  return (
    <div className="flex-1 w-full bg-[#0a1017] flex justify-center py-8 overflow-y-auto">
      <SubscriptionCheckout />
    </div>
  );
}
