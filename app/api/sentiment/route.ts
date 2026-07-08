import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ─── Helper: Fetch price change % from Yahoo Finance ─────────────────────────
async function fetchPriceChange(symbol: string, range: string): Promise<number | null> {
  try {
    const yfRangeMap: Record<string, { range: string; interval: string }> = {
      "24h": { range: "2d",  interval: "1d" },
      "7d":  { range: "7d",  interval: "1d" },
      "30d": { range: "1mo", interval: "1d" },
    };
    const yfParams = yfRangeMap[range] ?? { range: "2d", interval: "1d" };

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${yfParams.range}&interval=${yfParams.interval}`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const closes = result.indicators.quote[0].close as (number | null)[];
    const opens  = result.indicators.quote[0].open  as (number | null)[];

    if (range === "24h") {
      // Latest trading day: open → close
      const latestClose = closes[closes.length - 1];
      const latestOpen  = opens[opens.length - 1];
      if (latestClose == null || latestOpen == null || latestOpen === 0) return null;
      return ((latestClose - latestOpen) / latestOpen) * 100;
    } else {
      // Multi-day range: first open → last close
      const firstOpen = opens.find((v) => v != null);
      const lastClose = [...closes].reverse().find((v) => v != null);
      if (firstOpen == null || lastClose == null || firstOpen === 0) return null;
      return ((lastClose - firstOpen) / firstOpen) * 100;
    }
  } catch {
    return null;
  }
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
    const resultsArray = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          // ── 1. Price change % from Yahoo Finance ─────────────────────────
          const priceChangePercent = await fetchPriceChange(symbol, range);

          // Price Score (-10 to +10): ±0.5% per point, capped at ±5%
          const priceScore: number | null =
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

          // ── 3. No news — use price data alone ───────────────────────────
          if (relatedNews.length === 0) {
            const fallbackScore = priceScore ?? 0;
            const fallbackSentiment =
              fallbackScore > 0 ? "up" : fallbackScore < 0 ? "down" : "flat";
            const absFallback = Math.abs(fallbackScore);
            const fallbackImpact =
              absFallback >= 7 ? "high" : absFallback >= 4 ? "medium" : "low";
            return [
              {
                symbol,
                impactLevel: fallbackImpact,
                sentiment: fallbackSentiment,
                mentionCount: 0,
                score: fallbackScore,
                sentimentHistorical: { positive: 0, negative: 0, neutral: 0 },
                latestNewsDate: null,
              },
            ];
          }

          // ── 4. Group news by New York calendar date ──────────────────────
          const dateGroups: Record<string, typeof relatedNews> = {};
          for (const item of relatedNews) {
            const dateKey = item.publishedAt.toLocaleDateString("en-US", {
              timeZone: "America/New_York",
            });
            if (!dateGroups[dateKey]) dateGroups[dateKey] = [];
            dateGroups[dateKey].push(item);
          }

          // ── 5. Per-date stats ────────────────────────────────────────────
          const dailyStats = Object.entries(dateGroups).map(([_, newsList]) => {
            let positive = 0, negative = 0, neutral = 0;
            let highCount = 0, mediumCount = 0, lowCount = 0;

            for (const news of newsList) {
              if (news.sentiment === "good") positive++;
              else if (news.sentiment === "bad") negative++;
              else neutral++;

              if (news.impact === "high") highCount++;
              else if (news.impact === "medium") mediumCount++;
              else lowCount++;
            }

            const totalNews = newsList.length;
            const sentimentHistorical = { positive, negative, neutral };

            // News Score (-10 to +10): net sentiment ratio
            const newsScore = Math.round(((positive - negative) / totalNews) * 10);

            // Hybrid Score: price direction carries 60%, news carries 40%
            const hybridScore =
              priceScore != null
                ? Math.round(priceScore * 0.6 + newsScore * 0.4)
                : newsScore;
            const finalScore = clamp(hybridScore, -10, 10);

            // ── Sentiment: price direction is ground truth ───────────────
            // Tiebreak when priceScore == 0 or unavailable: use news majority
            let sentiment: "up" | "down" | "flat";
            if (priceScore != null && priceScore !== 0) {
              sentiment = priceScore > 0 ? "up" : "down";
            } else {
              if (positive > negative) sentiment = "up";
              else if (negative > positive) sentiment = "down";
              else sentiment = "flat";
            }

            // ── Impact: take the higher of price magnitude vs news majority ─
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
              latestNewsDate: newsList[0].publishedAt.toISOString(),
            };
          });

          // Sort by date descending
          dailyStats.sort(
            (a, b) =>
              new Date(b.latestNewsDate!).getTime() -
              new Date(a.latestNewsDate!).getTime()
          );

          return dailyStats;
        } catch (err) {
          console.error(`[Sentiment API] Error processing ${symbol}:`, err);
          return [];
        }
      })
    );

    const results = resultsArray.flat();
    return NextResponse.json({ success: true, data: results });

  } catch (error: any) {
    console.error("[Sentiment API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
