import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ─── Helper: Fetch overall price change % for the range (with Finviz fallback) ──
async function fetchPriceChange(symbol: string, range: string): Promise<number | null> {
  // ── 1. Try Yahoo Finance ─────────────────────────────────────────────────
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
          // Also try meta.regularMarketChangePercent (works when market is open)
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

  // ── 2. Fallback: Finviz current day quote Change ──────────────────────────
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

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get("symbols");
    const range = searchParams.get("range")?.toLowerCase() || "24h";

    // Calculate DB cutoff date from range
    let cutoffDate: Date | null = null;
    if (range === "24h") {
      cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (range === "7d") {
      cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30d") {
      cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    let symbols: string[] = [];
    if (symbolsParam) {
      symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase());
    } else {
      // Auto-discover tickers from recent news in DB
      const recentNews = await prisma.news.findMany({
        where: cutoffDate ? { publishedAt: { gte: cutoffDate } } : {},
        select: { tickers: true },
      });

      const symbolSet = new Set<string>();
      for (const item of recentNews) {
        try {
          const tickersList = JSON.parse(item.tickers as string) || [];
          for (const t of tickersList) {
            const sym = typeof t === "string" ? t : (t as any).symbol;
            if (sym) symbolSet.add(sym.toUpperCase());
          }
        } catch { /* ignore */ }
      }
      symbols = Array.from(symbolSet);
    }

    // For each symbol: fetch price + news, compute hybrid score
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          // ── 1. Fetch overall price change for this symbol ────────────────
          const priceChangePercent = await fetchPriceChange(symbol, range);
          const priceScore =
            priceChangePercent != null
              ? clamp(Math.round(priceChangePercent * 2), -10, 10)
              : null;

          // ── 2. Related news from DB ──────────────────────────────────────
          const relatedNews = await prisma.news.findMany({
            where: {
              tickers: { contains: `"${symbol}"` },
              ...(cutoffDate ? { publishedAt: { gte: cutoffDate } } : {}),
            },
            orderBy: { publishedAt: "desc" },
            select: { sentiment: true, impact: true, publishedAt: true },
          });

          // ── 3. No news fallback ──────────────────────────────────────────
          if (relatedNews.length === 0) {
            const fallbackScore = priceScore ?? 0;
            const fallbackSentiment =
              fallbackScore > 0 ? "up" : fallbackScore < 0 ? "down" : "flat";
            const absFallback = Math.abs(fallbackScore);
            const fallbackImpact =
              absFallback >= 7 ? "high" : absFallback >= 4 ? "medium" : "low";

            return {
              symbol,
              impactLevel: fallbackImpact,
              sentiment: fallbackSentiment,
              mentionCount: 0,
              score: fallbackScore,
              sentimentHistorical: { positive: 0, negative: 0, neutral: 0 },
              latestNewsDate: null,
            };
          }

          // ── 4. Aggregate stats for the selected range ────────────────────
          let positive = 0, negative = 0, neutral = 0;
          let highCount = 0, mediumCount = 0, lowCount = 0;

          for (const news of relatedNews) {
            if (news.sentiment === "good") positive++;
            else if (news.sentiment === "bad") negative++;
            else neutral++;

            if (news.impact === "high") highCount++;
            else if (news.impact === "medium") mediumCount++;
            else lowCount++;
          }

          const totalNews = relatedNews.length;
          const sentimentHistorical = { positive, negative, neutral };

          // News Score (-10 to +10): net sentiment ratio
          const newsScore = Math.round(((positive - negative) / totalNews) * 10);

          // Hybrid Score: price direction carries 60%, news carries 40%
          const hybridScore =
            priceScore != null
              ? Math.round(priceScore * 0.6 + newsScore * 0.4)
              : newsScore;
          const finalScore = clamp(hybridScore, -10, 10);

          // Sentiment: follows the final hybrid score
          const sentiment: "up" | "down" | "flat" =
            finalScore > 0 ? "up" : finalScore < 0 ? "down" : "flat";

          // Impact: take the higher of price magnitude vs news majority
          let priceMagnitudeImpact: "high" | "medium" | "low" = "low";
          if (priceChangePercent != null) {
            const absPct = Math.abs(priceChangePercent);
            if (absPct >= 3.5) priceMagnitudeImpact = "high";
            else if (absPct >= 2.0) priceMagnitudeImpact = "medium";
          }

          const newsMajorityImpact: "high" | "medium" | "low" =
            highCount >= mediumCount && highCount >= lowCount
              ? "high"
              : mediumCount >= lowCount
              ? "medium"
              : "low";

          const impactRank = { high: 3, medium: 2, low: 1 };
          const impactLevel: "high" | "medium" | "low" =
            impactRank[priceMagnitudeImpact] >= impactRank[newsMajorityImpact]
              ? priceMagnitudeImpact
              : newsMajorityImpact;

          return {
            symbol,
            impactLevel,
            sentiment,
            mentionCount: totalNews,
            score: finalScore,
            sentimentHistorical,
            latestNewsDate: relatedNews[0].publishedAt.toISOString(),
          };
        } catch (err) {
          console.error(`[Sentiment API] Error processing ${symbol}:`, err);
          return null;
        }
      })
    );

    // Filter out nulls
    const filteredResults = results.filter((r) => r !== null);
    return NextResponse.json({ success: true, data: filteredResults });

  } catch (error: any) {
    console.error("[Sentiment API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

