'use client';

import { usePageLayout } from '@/hooks/usePageLayout';
import { SubscriptionCheckout } from '@/components/subscription/SubscriptionCheckout';

export default function SubscriptionPage() {
  usePageLayout({
    useDefaultSidebar: false,
    showTopBar: true,
  });

  return (
    <div className="flex-1 w-full bg-[#0a1017] flex justify-center py-8 overflow-y-auto">
      <SubscriptionCheckout />
    </div>
  );
}
