'use client';

import { useEffect, useRef } from 'react';

interface SymbolData {
  symbol: string;
  name?: string;
}

interface TradingViewSymbolOverviewProps {
  symbols: (string | SymbolData)[];
  title?: string;
  height?: number;
}

export function TradingViewSymbolOverview({
  symbols,
  title = 'Trending Stock Symbol Overview',
  height = 500
}: TradingViewSymbolOverviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget content
    containerRef.current.innerHTML = '';

    // Create the container element TradingView expects
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = `${height}px`;
    widgetContainer.style.width = '100%';
    containerRef.current.appendChild(widgetContainer);

    // Create the script element
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;

    const nyseSymbols = new Set(['JPM', 'XOM', 'V', 'JNJ', 'WMT', 'UNH', 'PFE', 'BAC', 'KO', 'DIS', 'NKE']);

    // Map input symbols into TradingView symbol overview tuples: [displayName, "EXCHANGE:TICKER|1D"]
    const formattedSymbols = symbols.map(item => {
      const symStr = typeof item === 'string' ? item : item.symbol;
      const displayName = typeof item === 'object' && item.name ? item.name : symStr.toUpperCase();
      const cleanSym = symStr.toUpperCase();
      const exchange = nyseSymbols.has(cleanSym) ? 'NYSE' : 'NASDAQ';
      return [displayName, `${exchange}:${cleanSym}|1D`];
    });

    const defaultSymbols = [
      ['Apple', 'NASDAQ:AAPL|1D'],
      ['NVIDIA', 'NASDAQ:NVDA|1D'],
      ['Tesla', 'NASDAQ:TSLA|1D'],
      ['Amazon', 'NASDAQ:AMZN|1D'],
      ['Microsoft', 'NASDAQ:MSFT|1D'],
    ];

    const finalSymbols = formattedSymbols.length > 0 ? formattedSymbols : defaultSymbols;

    const config = {
      symbols: finalSymbols,
      chartOnly: false,
      width: '100%',
      height: height,
      locale: 'en',
      colorTheme: 'dark',
      autosize: true,
      showVolume: false,
      showMA: true,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
      scalePosition: 'right',
      scaleMode: 'Normal',
      fontFamily: '-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif',
      fontSize: '10',
      noTimeScale: false,
      valuesTracking: '1',
      changeMode: 'price-and-percent',
      chartType: 'candlesticks',
      isTransparent: true,
    };

    script.innerHTML = JSON.stringify(config);
    containerRef.current.appendChild(script);

  }, [symbols, height]);

  return (
    <div className="bg-[#0b1017]/90 border border-[#222F44] rounded-xl p-6 shadow-2xl relative overflow-hidden">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-white text-md font-bold tracking-wide uppercase">{title}</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Interactive chart overview for active stock tickers extracted dynamically from our news database
          </p>
        </div>
      </div>
      <div ref={containerRef} className="tradingview-widget-container w-full" style={{ minHeight: `${height}px` }}>
        {/* TradingView widget mounts here */}
      </div>
    </div>
  );
}
