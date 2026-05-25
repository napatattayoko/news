import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#1e2330] flex items-center justify-center p-4">
      {/* Background overlay or elements can go here if needed */}
      <div className="w-full max-w-[400px]">
        {children}
      </div>
    </div>
  );
}
