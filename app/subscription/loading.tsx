export default function SubscriptionLoading() {
  return (
    <div className="flex h-full bg-[#0a1017]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TopBar Skeleton */}
        <div className="h-14 border-b border-[#222F44] flex items-center px-4 gap-3 bg-[#0a1017]">
          <div className="h-8 w-8 bg-slate-700/50 rounded animate-pulse" />
          <div className="h-4 w-32 bg-slate-700/40 rounded animate-pulse" />
        </div>

        <div className="flex-1 overflow-y-auto pb-28 lg:pb-0 flex justify-center py-8">
            <div className="w-full max-w-5xl px-4 space-y-6">
                <div className="h-8 w-64 bg-slate-700/50 rounded animate-pulse" />
                <div className="h-64 w-full bg-slate-700/50 rounded-xl animate-pulse" />
                <div className="h-48 w-full bg-slate-700/50 rounded-xl animate-pulse" />
            </div>
        </div>
      </div>
    </div>
  );
}
