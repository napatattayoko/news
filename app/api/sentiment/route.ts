import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ─── Helper: Fetch overall price change % for the range (with Finviz fallback) ──
async function fetchPriceChange(symbol: string, range: string): Promise<number | null> {
  try {
    const yfRangeMap: Record<string, { range: string; interval: string }> = {
      "24h": { range: "2d",  interval: "1d" },
      "7d":  { range: "7d",  interval: "1d" },
      "30d": { range: "1mo", interval: "1d" },
    };
    const yfParams = yfRangeMap[range] ?? { range: "2d", interval: "1d" };

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${yfParams.range}&interval=${yfParams.interval}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (result) {
        const closes = result.indicators.quote[0].close as (number | null)[];
        const opens  = result.indicators.quote[0].open  as (number | null)[];

        if (range === "24h") {
          const latestClose = closes[closes.length - 1];
          const latestOpen  = opens[opens.length - 1];
          if (latestClose != null && latestOpen != null && latestOpen !== 0) {
            return ((latestClose - latestOpen) / latestOpen) * 100;
          }
          const liveChange = result.meta?.regularMarketChangePercent;
          if (liveChange != null) return liveChange;
        } else {
          const firstOpen = opens.find((v) => v != null);
          const lastClose = [...closes].reverse().find((v) => v != null);
          if (firstOpen != null && lastClose != null && firstOpen !== 0) {
            return ((lastClose - firstOpen) / firstOpen) * 100;
          }
        }
      }
    }
  } catch { /* fall through to Finviz */ }

  try {
    const finvizRes = await fetch(`https://finviz.com/quote.ashx?t=${symbol}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
        "Referer": "https://finviz.com/",
      },
    });
    if (finvizRes.ok) {
      const html = await finvizRes.text();
      const match = html.match(/<td[^>]*>Change<\/td>\s*<td[^>]*>([-\d.]+)%<\/td>/i)
        ?? html.match(/data-testid="quote-change-percent"[^>]*>([-\d.]+)/i);

      const changeMatch = html.match(/title="Change"[\s\S]*?<b>([-+]?[\d.]+)%<\/b>/i)
        ?? html.match(/>Change<\/td>[\s\S]{0,200}?>([-+]?[\d.]+)%</i);

      const rawChange = match?.[1] ?? changeMatch?.[1];
      if (rawChange != null) {
        const pct = parseFloat(rawChange);
        if (!isNaN(pct)) {
          return pct;
        }
      }
    }
  } catch { /* ignore */ }

  return null;
}

// ─── Helper: Fetch daily price change map for standard dates ───
async function fetchDailyPriceChanges(symbol: string, range: string): Promise<Record<string, number>> {
  const dailyChanges: Record<string, number> = {};
  try {
    const yfRangeMap: Record<string, { range: string; interval: string }> = {
      "24h": { range: "5d",  interval: "1d" },
      "7d":  { range: "10d", interval: "1d" },
      "30d": { range: "45d", interval: "1d" },
    };
    const yfParams = yfRangeMap[range] ?? { range: "5d", interval: "1d" };

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${yfParams.range}&interval=${yfParams.interval}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (result) {
        const timestamps = result.timestamp as number[];
        const closes = result.indicators.quote[0].close as (number | null)[];
        const opens  = result.indicators.quote[0].open  as (number | null)[];

        if (timestamps && closes && opens) {
          for (let i = 0; i < timestamps.length; i++) {
            const open = opens[i];
            const close = closes[i];
            if (open != null && close != null && open !== 0) {
              const dateObj = new Date(timestamps[i] * 1000);
              const dateKey = dateObj.toLocaleDateString("en-US", {
                timeZone: "America/New_York",
              });
              dailyChanges[dateKey] = ((close - open) / open) * 100;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[Daily Price Chart] Error fetching for ${symbol}:`, err);
  }
  return dailyChanges;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get("symbols");
    const range = searchParams.get("range")?.toLowerCase() || "24h";

    let cutoffDate: Date | null = null;
    if (range === "24h") {
      cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (range === "7d") {
      cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30d") {
      cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    let filterSymbols: Set<string> | null = null;
    if (symbolsParam) {
      filterSymbols = new Set(symbolsParam.split(",").map((s) => s.trim().toUpperCase()));
    }

    // ── 1. Fetch all news in the selected range ──────────────────────────
    const newsItems = await prisma.news.findMany({
      where: cutoffDate ? { publishedAt: { gte: cutoffDate } } : {},
      orderBy: { publishedAt: "desc" },
    });

    const results: any[] = [];
    const matchedSymbols = new Set<string>();

    // Cache price changes in-request to prevent duplicate fetch calls
    const priceChangesCache = new Map<string, Record<string, number>>();

    // Pre-collect unique symbols that will be queried
    const uniqueSymbols = new Set<string>();
    for (const news of newsItems) {
      try {
        const parsed = JSON.parse(news.tickers as string) || [];
        const tickersList = parsed.map((t: any) => (typeof t === "string" ? t : t.symbol).toUpperCase());
        const active = filterSymbols 
          ? tickersList.filter((t: string) => filterSymbols!.has(t))
          : tickersList;
        for (const sym of active) {
          uniqueSymbols.add(sym);
        }
      } catch {}
    }

    // Fetch all price changes in parallel
    await Promise.all(
      Array.from(uniqueSymbols).map(async (symbol) => {
        try {
          const changes = await fetchDailyPriceChanges(symbol, range);
          priceChangesCache.set(symbol, changes);
        } catch (err) {
          console.error(`[Pre-fetch Price Error] Failed for ${symbol}:`, err);
          priceChangesCache.set(symbol, {});
        }
      })
    );

    // ── 2. Generate one row per news article per ticker ──────────────────
    for (const news of newsItems) {
      let tickersList: string[] = [];
      try {
        const parsed = JSON.parse(news.tickers as string) || [];
        tickersList = parsed.map((t: any) => (typeof t === "string" ? t : t.symbol).toUpperCase());
      } catch {
        continue;
      }

      // Filter tickers if symbolsParam is active
      const activeTickers = filterSymbols 
        ? tickersList.filter(t => filterSymbols!.has(t))
        : tickersList;

      for (const symbol of activeTickers) {
        matchedSymbols.add(symbol);

        // Retrieve pre-fetched price changes instantly
        const dailyPriceChanges = priceChangesCache.get(symbol) ?? {};
        const dateKey = news.publishedAt.toLocaleDateString("en-US", {
          timeZone: "America/New_York",
        });
        
        const priceChangePercent = dailyPriceChanges[dateKey] ?? Object.values(dailyPriceChanges)[0] ?? null;
        
        const priceScore =
          priceChangePercent != null
            ? clamp(Math.round(priceChangePercent * 2), -10, 10)
            : 0;

        const newsScore = news.sentiment === "good" ? 10 : news.sentiment === "bad" ? -10 : 0;
        const hybridScore = Math.round(priceScore * 0.6 + newsScore * 0.4);
        const finalScore = clamp(hybridScore, -10, 10);

        const sentiment: "up" | "down" | "flat" =
          finalScore > 0 ? "up" : finalScore < 0 ? "down" : "flat";

        let priceMagnitudeImpact: "high" | "medium" | "low" = "low";
        if (priceChangePercent != null) {
          const absPct = Math.abs(priceChangePercent);
          if (absPct >= 3.5) priceMagnitudeImpact = "high";
          else if (absPct >= 2.0) priceMagnitudeImpact = "medium";
        }

        const impactRank = { high: 3, medium: 2, low: 1 };
        const newsImpact = news.impact === "high" ? "high" : news.impact === "medium" ? "medium" : "low";
        const impactLevel: "high" | "medium" | "low" =
          impactRank[priceMagnitudeImpact] >= impactRank[newsImpact]
            ? priceMagnitudeImpact
            : newsImpact;

        results.push({
          id: `${news.id}-${symbol}`,
          symbol,
          impactLevel,
          sentiment,
          mentionCount: 1,
          score: finalScore,
          sentimentHistorical: {
            positive: news.sentiment === "good" ? 1 : 0,
            negative: news.sentiment === "bad" ? 1 : 0,
            neutral: news.sentiment === "neutral" ? 1 : 0,
          },
          latestNewsDate: news.publishedAt.toISOString(),
        });
      }
    }

    // ── 3. Fallback: Generate overall price action for symbols with 0 news if symbolsParam is set ──
    if (filterSymbols) {
      for (const symbol of filterSymbols) {
        if (!matchedSymbols.has(symbol)) {
          const priceChangePercent = await fetchPriceChange(symbol, range);
          const priceScore =
            priceChangePercent != null
              ? clamp(Math.round(priceChangePercent * 2), -10, 10)
              : 0;

          const fallbackSentiment = priceScore > 0 ? "up" : priceScore < 0 ? "down" : "flat";
          const absFallback = Math.abs(priceScore);
          const fallbackImpact = absFallback >= 7 ? "high" : absFallback >= 4 ? "medium" : "low";

          results.push({
            id: `fallback-${symbol}`,
            symbol,
            impactLevel: fallbackImpact,
            sentiment: fallbackSentiment,
            mentionCount: 0,
            score: priceScore,
            sentimentHistorical: { positive: 0, negative: 0, neutral: 0 },
            latestNewsDate: null,
          });
        }
      }
    }

    return NextResponse.json({ success: true, data: results });

  } catch (error: any) {
    console.error("[Sentiment API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

