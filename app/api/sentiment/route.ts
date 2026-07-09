import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ─── Helper: Fetch daily price change percents mapped by dateKey ─────────────
async function fetchDailyPriceChanges(symbol: string, range: string): Promise<Record<string, number>> {
  const priceChanges: Record<string, number> = {};

  // ── 1. Try Yahoo Finance Daily Chart ──────────────────────────────────────
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
          "Accept-Language": "en-US,en;q=0.9",
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
            const dateKey = new Date(timestamps[i] * 1000).toLocaleDateString("en-US", {
              timeZone: "America/New_York",
            });
            const open = opens[i];
            const close = closes[i];
            if (open != null && close != null && open !== 0) {
              priceChanges[dateKey] = ((close - open) / open) * 100;
            }
          }
          // If 24h, check live change as fallback
          if (range === "24h" && result.meta?.regularMarketChangePercent != null) {
            const todayKey = new Date().toLocaleDateString("en-US", {
              timeZone: "America/New_York",
            });
            if (priceChanges[todayKey] == null) {
              priceChanges[todayKey] = result.meta.regularMarketChangePercent;
            }
          }
        }
      }
    }
  } catch { /* fallback to Finviz */ }

  // If we got values from Yahoo Finance, return them
  if (Object.keys(priceChanges).length > 0) {
    return priceChanges;
  }

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
          const todayKey = new Date().toLocaleDateString("en-US", {
            timeZone: "America/New_York",
          });
          priceChanges[todayKey] = pct;
        }
      }
    }
  } catch { /* ignore */ }

  return priceChanges;
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
      // Auto-discover tickers from all news in the database
      const recentNews = await prisma.news.findMany({
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

    // For each symbol: fetch price map + news, compute hybrid score per date
    const resultsArray = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          // ── 1. Fetch daily price changes map for this symbol ─────────────
          const dailyPriceChanges = await fetchDailyPriceChanges(symbol, range);

          // ── 2. Related news from DB ──────────────────────────────────────
          const relatedNews = await prisma.news.findMany({
            where: {
              tickers: { contains: `"${symbol}"` },
              ...(cutoffDate ? { publishedAt: { gte: cutoffDate } } : {}),
            },
            orderBy: { publishedAt: "desc" },
            select: { sentiment: true, impact: true, publishedAt: true },
          });

          // ── 3. No news fallback — use today's price change ───────────────
          if (relatedNews.length === 0) {
            const todayKey = new Date().toLocaleDateString("en-US", {
              timeZone: "America/New_York",
            });
            const priceChangePercent = dailyPriceChanges[todayKey] ?? Object.values(dailyPriceChanges)[0] ?? null;
            const fallbackScore = priceChangePercent != null ? clamp(Math.round(priceChangePercent * 2), -10, 10) : 0;
            const fallbackSentiment =
              fallbackScore > 0 ? "up" : fallbackScore < 0 ? "down" : "flat";
            const absFallback = Math.abs(fallbackScore);
            const fallbackImpact =
              absFallback >= 7 ? "high" : absFallback >= 4 ? "medium" : "low";

            // Use the latest date from chart or today's date
            const latestChartDate = Object.keys(dailyPriceChanges).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? todayKey;
            const fallbackDateIso = new Date(latestChartDate).toISOString();

            return [
              {
                symbol,
                impactLevel: fallbackImpact,
                sentiment: fallbackSentiment,
                mentionCount: 0,
                score: fallbackScore,
                sentimentHistorical: { positive: 0, negative: 0, neutral: 0 },
                latestNewsDate: fallbackDateIso,
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
          const dailyStats = Object.entries(dateGroups).map(([dateKey, newsList]) => {
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

            // Get daily price change for this specific day
            const priceChangePercent = dailyPriceChanges[dateKey] ?? null;
            const priceScore =
              priceChangePercent != null
                ? clamp(Math.round(priceChangePercent * 2), -10, 10)
                : null;

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

