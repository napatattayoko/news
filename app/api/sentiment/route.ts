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

    // We will query the DB for each symbol.
    // For small arrays of symbols (e.g. 10-20), Promise.all is perfectly fine and fast.
    const resultsArray = await Promise.all(
      symbols.map(async (symbol) => {
        // Find all news that contains the symbol in the JSON string within the time range
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
            impact: true,
            sentiment: true,
            publishedAt: true,
          },
        });

        // If no news found in DB, return default empty stats (no fallback to mock data)
        if (relatedNews.length === 0) {
          return [
            {
              symbol,
              impactLevel: "low",
              sentiment: "flat",
              mentionCount: 0,
              score: 5,
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

        // For each date group, calculate the stats
        const dailyStats = Object.entries(dateGroups).map(([_, newsList]) => {
          const latestNews = newsList[0];
          const impactLevel = latestNews.impact;
          const sentiment =
            latestNews.sentiment === "good"
              ? "up"
              : latestNews.sentiment === "bad"
                ? "down"
                : "flat";

          // 1. Calculate Sentiment Historical by counting positive, negative, and neutral mentions
          let positive = 0;
          let negative = 0;
          let neutral = 0;

          for (const news of newsList) {
            if (news.sentiment === "good") {
              positive++;
            } else if (news.sentiment === "bad") {
              negative++;
            } else {
              neutral++;
            }
          }
          const sentimentHistorical = { positive, negative, neutral };

          // 2. Calculate Actionable Score (1 to 10) based on Sentiment and Impact
          const getNewsScore = (s: string, imp: string): number => {
            const isDirectional = s === "good" || s === "bad";
            if (isDirectional) {
              if (imp === "high") return 10;
              if (imp === "medium") return 8;
              return 6;
            } else {
              if (imp === "high") return 5;
              if (imp === "medium") return 3;
              return 1;
            }
          };

          const totalScore = newsList.reduce(
            (sum, news) => sum + getNewsScore(news.sentiment, news.impact),
            0,
          );
          const score = Math.round(totalScore / newsList.length);

          return {
            symbol,
            impactLevel,
            sentiment,
            mentionCount: newsList.length,
            score,
            sentimentHistorical,
            latestNewsDate: latestNews.publishedAt.toISOString(),
          };
        });

        return dailyStats;
      }),
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
