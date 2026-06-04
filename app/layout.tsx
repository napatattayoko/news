import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import PlanToggle from '@/components/dev/PlanToggle';
import Toaster from '@/components/ui/Toaster';
import { LayoutProvider } from '@/components/layout/LayoutProvider';
import PageContent from '@/components/layout/PageContent';
import NewsSync from '@/components/layout/NewsSync';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-poppins' });

export const metadata: Metadata = {
  title: 'Impact Terminal — Financial News Dashboard',
  description: 'Real-time market-moving news with ticker integration for financial professionals',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} font-sans bg-[#0a1017] text-slate-100 antialiased`}>
        <LayoutProvider>
          <div className="flex h-screen overflow-hidden bg-[#0a1017]">
            {/* Sidebar — overlay on mobile, static on desktop */}
            <Sidebar />
            {/* Main content fills remaining width on desktop; full width on mobile */}
            <main className="flex-1 relative min-w-0">
              <PageContent>
                {children}
              </PageContent>
            </main>
            <MobileBottomNav />
            <PlanToggle />
          </div>
          <Toaster />
          <NewsSync />
        </LayoutProvider>
      </body>
    </html>
  );
}
