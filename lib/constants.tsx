
import Image from 'next/image';
import { Globe } from 'lucide-react';
import { Category, Region, RegionTab, SortOrder, ImpactLevel } from './types';
import { mockNews } from './api';

// ─── Categories ──────────────────────────────────────────────────────────

// ─── Main tabs shown on desktop ribbon ───────────────────────────────
export const categoryTabs: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'markets', label: 'Markets' },
  { id: 'economy', label: 'Economy' },
  { id: 'geopolitics', label: 'Geopolitics' },
  { id: 'tech', label: 'Tech' },
  { id: 'ai', label: 'AI' },
];

// ─── "Other" dropdown on desktop ─────────────────────────────────────
export const otherOptions: { id: Category; label: string }[] = [
  { id: 'crypto', label: 'Crypto' },
  { id: 'energy', label: 'Energy' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'real-estate', label: 'Real Estate' },
  { id: 'climate', label: 'Climate' },
  { id: 'defense', label: 'Defense' },
  { id: 'banking', label: 'Banking' },
  { id: 'automotive', label: 'Automotive' },
  { id: 'trade', label: 'Trade' },
];

// For Desktop: Categories that appear in the "Other" dropdown
export const otherCategoryIds: Category[] = otherOptions.map((o) => o.id);

// For Mobile: Combined list (main tabs first, then others, "All" at top)
export const categoryOptions: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'markets', label: 'Markets' },
  { id: 'economy', label: 'Economy' },
  { id: 'geopolitics', label: 'Geopolitics' },
  { id: 'tech', label: 'Tech' },
  { id: 'ai', label: 'AI' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'energy', label: 'Energy' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'real-estate', label: 'Real Estate' },
  { id: 'climate', label: 'Climate' },
  { id: 'defense', label: 'Defense' },
  { id: 'banking', label: 'Banking' },
  { id: 'automotive', label: 'Automotive' },
  { id: 'trade', label: 'Trade' },
];

// ─── Sorting ─────────────────────────────────────────────────────────────

export const sortOptions: { value: SortOrder; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'impact', label: 'High Impact' },
  { value: 'oldest', label: 'Oldest' },
];

// ─── Countries ───────────────────────────────────────────────────────────

// Build countries per region from actual news data, sorted A-Z
export const countriesByRegion: Record<RegionTab, Region[]> = { global: [], us: [], eu: [], asia: [], mena: [] };
for (const n of mockNews) {
  const c = n.countryCode as Region;
  if (c === 'global') continue;
  if (!countriesByRegion[n.regionTag].includes(c)) countriesByRegion[n.regionTag].push(c);
  if (!countriesByRegion.global.includes(c)) countriesByRegion.global.push(c);
}
for (const key of Object.keys(countriesByRegion) as RegionTab[]) {
  countriesByRegion[key].sort();
}

// ─── Impact Level Configs ────────────────────────────────────────────

// Full labels with colored backgrounds - used in NewsCard
export const impactConfigFull: Record<ImpactLevel, { label: string; bg: string; text: string; border: string }> = {
  high: {
    label: 'HIGH IMPACT',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  medium: {
    label: 'MEDIUM IMPACT',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  low: {
    label: 'LOW IMPACT',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
};

// Compact labels with transparent backgrounds - used in tables
export const impactConfigCompact: Record<ImpactLevel, { label: string; bg: string; text: string; border: string }> = {
  high: {
    label: 'HIGH',
    bg: 'bg-transparent',
    text: 'text-red-400',
    border: 'border border-red-400/20',
  },
  medium: {
    label: 'MEDIUM',
    bg: 'bg-transparent',
    text: 'text-amber-400',
    border: 'border border-amber-400/20',
  },
  low: {
    label: 'LOW',
    bg: 'bg-transparent',
    text: 'text-blue-400',
    border: 'border border-blue-400/20',
  },
};

// ─── Country Flag Component ──────────────────────────────────────────

export function CountryFlag({ code, size = 20 }: { code?: Region | 'all'; size?: number }) {
  const normalizedCode = code || 'global';
  if (normalizedCode === 'all' || normalizedCode === 'global') {
    return <Globe size={size} className="text-white" />;
  }
  return (
    <Image
      src={`https://flagcdn.com/w40/${normalizedCode}.png`}
      alt={normalizedCode.toUpperCase()}
      width={size}
      height={size}
      className="w-5 h-5 rounded-full object-cover"
      unoptimized
    />
  );
}

// ─── Custom Eye / EyeOff Icons matching design ─────────────────────

export function EyeIcon({ className = "w-[18px] h-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
      />
    </svg>
  );
}

export function EyeOffIcon({ className = "w-[18px] h-[18px]", idSuffix = "def" }: { className?: string; idSuffix?: string }) {
  const maskId = `eye-off-mask-${idSuffix}`;
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          <line x1="2" y1="2" x2="22" y2="22" stroke="black" strokeWidth="4.5" strokeLinecap="round" />
        </mask>
      </defs>
      <path
        mask={`url(#${maskId})`}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
      />
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

