import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get("symbols");
    const range = searchParams.get("range")?.toLowerCase() || "24h";

    // Calculate time range cutoff date
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
      // Find all tickers mentioned in news within the cutoff range
      const recentNews = await prisma.news.findMany({
        where: cutoffDate ? {
          publishedAt: {
            gte: cutoffDate,
          },
        } : {},
        select: {
          tickers: true,
        },
      });

      const symbolSet = new Set<string>();
      for (const item of recentNews) {
        try {
          const tickersList = JSON.parse(item.tickers as string) || [];
          for (const t of tickersList) {
            const sym = typeof t === "string" ? t : (t as any).symbol;
            if (sym) {
              symbolSet.add(sym.toUpperCase());
            }
          }
        } catch (e) {
          // ignore
        }
      }
      symbols = Array.from(symbolSet);
    }

    // For each symbol, query the news in the DB, group by date, and calculate the averaged consensus
    const resultsArray = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          // Fetch related news from DB
          const relatedNews = await prisma.news.findMany({
            where: {
              tickers: {
                contains: `"${symbol}"`,
              },
              ...(cutoffDate
                ? {
                    publishedAt: {
                      gte: cutoffDate,
                    },
                  }
                : {}),
            },
            orderBy: { publishedAt: "desc" },
            select: {
              sentiment: true,
              impact: true,
              publishedAt: true,
            },
          });

          // If no news found in DB, return default empty stats
          if (relatedNews.length === 0) {
            return [
              {
                symbol,
                impactLevel: "low",
                sentiment: "flat",
                mentionCount: 0,
                score: 0,
                sentimentHistorical: { positive: 0, negative: 0, neutral: 0 },
                latestNewsDate: null,
              },
            ];
          }

          // Group news by New York calendar date (M/D/YYYY)
          const dateGroups: Record<string, typeof relatedNews> = {};
          for (const item of relatedNews) {
            const dateKey = item.publishedAt.toLocaleDateString("en-US", {
              timeZone: "America/New_York",
            });
            if (!dateGroups[dateKey]) {
              dateGroups[dateKey] = [];
            }
            dateGroups[dateKey].push(item);
          }

          const impactWeights: Record<string, number> = { high: 3, medium: 2, low: 1 };

          // Calculate averaged statistics for each date group
          const dailyStats = Object.entries(dateGroups).map(([_, newsList]) => {
            let positive = 0;
            let negative = 0;
            let neutral = 0;
            let totalImpactWeight = 0;

            for (const news of newsList) {
              if (news.sentiment === "good") positive++;
              else if (news.sentiment === "bad") negative++;
              else neutral++;

              totalImpactWeight += impactWeights[news.impact] || 1;
            }

            const totalNews = newsList.length;
            const sentimentHistorical = { positive, negative, neutral };

            // Calculate Net News Sentiment Score (-10 to +10)
            const netSentiment = (positive - negative) / totalNews;
            const score = Math.round(netSentiment * 10);

            const sentiment = score > 0 ? "up" : score < 0 ? "down" : "flat";

            // Calculate Average News Impact level
            const avgImpactWeight = totalImpactWeight / totalNews;
            const impactLevel =
              avgImpactWeight >= 2.5 ? "high" : avgImpactWeight >= 1.5 ? "medium" : "low";

            return {
              symbol,
              impactLevel,
              sentiment,
              mentionCount: totalNews,
              score,
              sentimentHistorical,
              latestNewsDate: newsList[0].publishedAt.toISOString(),
            };
          });

          // Sort daily stats by date descending
          dailyStats.sort(
            (a, b) => new Date(b.latestNewsDate).getTime() - new Date(a.latestNewsDate).getTime()
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
      { status: 500 },
    );
  }
}
