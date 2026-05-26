'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import TopBar from './TopBar';
import RightSidebar from './RightSidebar';
import { useLayout } from './LayoutProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

interface PageContentProps {
  children: ReactNode;
}

export default function PageContent({ children }: PageContentProps) {
  const { rightSidebarContent, useDefaultRightSidebar, showTopBar } = useLayout();
  const pathname = usePathname();

  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full bg-[#0a1017]">
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showTopBar && (
          <ErrorBoundary>
            <TopBar />
          </ErrorBoundary>
        )}
        {children}
      </div>

      {/* Right sidebar - either default or custom */}
      {useDefaultRightSidebar ? (
        <ErrorBoundary>
          <RightSidebar />
        </ErrorBoundary>
      ) : rightSidebarContent ? (
        <ErrorBoundary>
          {rightSidebarContent}
        </ErrorBoundary>
      ) : null}
    </div>
  );
}
