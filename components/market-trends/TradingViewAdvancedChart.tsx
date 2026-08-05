'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewAdvancedChartProps {
  symbol?: string;
  theme?: 'light' | 'dark';
  height?: number | string;
}

export function TradingViewAdvancedChart({
  symbol = 'NASDAQ:AAPL',
  theme = 'dark',
  height = '75vh'
}: TradingViewAdvancedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const containerId = 'tradingview_advanced_chart';
    
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      
      const widgetDiv = document.createElement('div');
      widgetDiv.id = containerId;
      widgetDiv.style.width = '100%';
      widgetDiv.style.height = '100%';
      containerRef.current.appendChild(widgetDiv);
    }

    const scriptId = 'tradingview-advanced-chart-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initWidget = () => {
      if (window.TradingView) {
        new window.TradingView.widget({
          autosize: true,
          symbol: symbol,
          interval: 'D',
          timezone: 'Etc/UTC',
          theme: theme,
          style: '1',
          locale: 'en',
          enable_publishing: false,
          allow_symbol_change: true,
          calendar: true,
          support_host: 'https://www.tradingview.com',
          container_id: containerId
        });
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://s3.tradingview.com/tv.js';
      script.type = 'text/javascript';
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      if (window.TradingView) {
        initWidget();
      } else {
        script.addEventListener('load', initWidget);
      }
    }

    return () => {
      if (script) {
        script.removeEventListener('load', initWidget);
      }
    };
  }, [symbol, theme]);

  return (
    <div className="bg-[#0b1017] border border-[#222F44] rounded-xl p-4 shadow-2xl relative overflow-hidden flex flex-col w-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full flex-1" />
    </div>
  );
}
