'use client';

import { useEffect, useRef } from 'react';

interface TradingViewMarketOverviewProps {
  symbols: string[];
}

export function TradingViewMarketOverview({ symbols }: TradingViewMarketOverviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget content
    containerRef.current.innerHTML = '';

    // Create the container elements TradingView expects
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    containerRef.current.appendChild(widgetContainer);

    // Create the script element
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
    script.type = 'text/javascript';
    script.async = true;

    // Map the news database symbols to TradingView symbols
    // Most US equities are on NASDAQ or NYSE. 
    // We map them to NASDAQ for simplicity or can support NYSE for specific ones if desired
    const nyseSymbols = new Set(['JPM', 'XOM', 'V', 'JNJ', 'WMT', 'UNH', 'PFE', 'BAC', 'KO', 'DIS', 'NKE']);
    
    const tradingViewSymbols = symbols.map(sym => {
      const cleanSym = sym.toUpperCase();
      const exchange = nyseSymbols.has(cleanSym) ? 'NYSE' : 'NASDAQ';
      return {
        name: `${exchange}:${cleanSym}`,
        displayName: cleanSym,
      };
    });

    const symbolsGroups = tradingViewSymbols.length > 0
      ? [
          {
            originalName: 'Trending News Stocks',
            symbols: tradingViewSymbols,
          }
        ]
      : [
          {
            originalName: 'Market Indices',
            symbols: [
              { name: 'FOREXCOM:SPXUSD', displayName: 'S&P 500' },
              { name: 'FOREXCOM:NSXUSD', displayName: 'Nasdaq 100' },
              { name: 'FOREXCOM:DJI', displayName: 'Dow 30' },
            ],
          }
        ];

    const config = {
      showSymbolLogo: true,
      colorTheme: 'dark',
      isTransparent: true,
      displayMode: 'regular',
      width: '100%',
      height: 400,
      locale: 'en',
      symbolsGroups: symbolsGroups,
    };

    script.innerHTML = JSON.stringify(config);
    containerRef.current.appendChild(script);

  }, [symbols]);

  return (
    <div className="bg-[#0b1017]/80 border border-[#222F44] rounded-xl p-6 shadow-2xl relative overflow-hidden">
      <div className="mb-4">
        <h2 className="text-white text-md font-bold tracking-wide uppercase">Real-Time Market Overview</h2>
        <p className="text-slate-400 text-xs">Live stock charts and price actions from TradingView mapped directly to the trending tickers in our news feed</p>
      </div>
      <div ref={containerRef} className="tradingview-widget-container min-h-[400px]">
        {/* TradingView widget will mount here */}
      </div>
    </div>
  );
}
