'use client';

import { useState } from 'react';
import { X, ArrowUpRight } from 'lucide-react';


export default function LiveUpdateWidget() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div
      className="bg-[#0F1924] border border-[#222F44] rounded-2xl p-4 relative cursor-pointer"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setVisible(false);
        }}
        className="absolute top-3 right-3 text-[#B3B3B3] hover:text-white transition-colors z-10"
      >
        <X size={16} />
      </button>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="font-bold text-white" style={{ fontSize: '16px' }}>
          Live Update
        </span>
      </div>
      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#222F44] rounded-lg font-medium text-white hover:bg-white/5 transition-colors" style={{ fontSize: '14px' }}
        onClick={() => window.open('https://www.bloomberg.com/live/us', '_blank', 'noopener,noreferrer')}
      >
        See more <ArrowUpRight size={14} />
      </button>
    </div>
  );
}
