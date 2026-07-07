import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Category, NewsItem } from "@/lib/types";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

import { scrapeAndStoreNews } from "@/bot/newsScraper";

let isScraping = false;
let lastScrapeTime = 0;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// ─── Scrape Functions (Restored) ──────────────────────

async function fetchMarket() {
  const response = await fetch("https://finviz.com/", {
    headers: HEADERS,
    next: { revalidate: 600 },
  });
  if (!response.ok) throw new Error("Failed to fetch market data");
  const html = await response.text();
  const $ = cheerio.load(html);
  const gainers: any[] = [];
  const losers: any[] = [];

  $("table.styled-table-new")
    .eq(0)
    .find("tr")
    .each((i, row) => {
      if (i === 0) return;
      const cols = $(row).find("td");
      if (cols.length >= 6) {
        gainers.push({
          symbol: $(cols[0]).text().trim(),
          last: $(cols[1]).text().trim(),
          change: $(cols[2]).text().trim(),
          volume: $(cols[3]).text().trim(),
        });
      }
    });

  $("table.styled-table-new")
    .eq(1)
    .find("tr")
    .each((i, row) => {
      if (i === 0) return;
      const cols = $(row).find("td");
      if (cols.length >= 6) {
        losers.push({
          symbol: $(cols[0]).text().trim(),
          last: $(cols[1]).text().trim(),
          change: $(cols[2]).text().trim(),
          volume: $(cols[3]).text().trim(),
        });
      }
    });

  return { gainers: gainers.slice(0, 10), losers: losers.slice(0, 10) };
}

async function fetchQuote(symbol: string) {
  const response = await fetch(`https://finviz.com/quote.ashx?t=${symbol}`, {
    headers: HEADERS,
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error("Failed to fetch quote");
  const html = await response.text();
  const $ = cheerio.load(html);

  const quoteData: Record<string, string> = {};
  $(".snapshot-table2 tr").each((i, row) => {
    const cols = $(row).find("td");
    for (let j = 0; j < cols.length; j += 2) {
      const key = $(cols[j]).text().trim();
      const val = $(cols[j + 1])
        .text()
        .trim();
      if (key) quoteData[key] = val;
    }
  });

  // Since we only need quote data (news is from DB now or we can skip news for quote), just return empty news for now.
  return { quote: quoteData, news: [] };
}

// ─── Main Route Handler ────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "news";

    if (action === "market") {
      const data = await fetchMarket();
      return NextResponse.json({ success: true, data });
    }

    if (action === "trending") {
      // Query news published in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      let news = await prisma.news.findMany({
        where: {
          publishedAt: {
            gte: oneDayAgo,
          },
        },
        orderBy: { publishedAt: "desc" },
      });

      // Fallback if less than 50 news in last 24 hours to ensure we show a rich dataset
      if (news.length < 50) {
        news = await prisma.news.findMany({
          orderBy: { publishedAt: "desc" },
          take: 200,
        });
      }

      // Aggregate ticker stats from news
      const tickerMap = new Map<
        string,
        {
          symbol: string;
          mentionCount: number;
          positiveCount: number;
          negativeCount: number;
          neutralCount: number;
          highestImpact: "high" | "medium" | "low";
        }
      >();

      for (const item of news) {
        let tickerList: string[] = [];
        try {
          tickerList = JSON.parse(item.tickers as string) || [];
        } catch (e) {
          // ignore
        }

        const parsedSentiment =
          item.sentiment === "bullish" || item.sentiment === "good"
            ? "good"
            : item.sentiment === "bearish" || item.sentiment === "bad"
              ? "bad"
              : "neutral";
        const impact =
          item.impact === "high" ||
          item.impact === "medium" ||
          item.impact === "low"
            ? item.impact
            : "low";

        for (const t of tickerList) {
          const symbol = typeof t === "string" ? t : (t as any).symbol;
          if (!symbol) continue;
          const upperSymbol = symbol.toUpperCase();

          if (!tickerMap.has(upperSymbol)) {
            tickerMap.set(upperSymbol, {
              symbol: upperSymbol,
              mentionCount: 0,
              positiveCount: 0,
              negativeCount: 0,
              neutralCount: 0,
              highestImpact: "low",
            });
          }

          const stats = tickerMap.get(upperSymbol)!;
          stats.mentionCount++;
          if (parsedSentiment === "good") stats.positiveCount++;
          else if (parsedSentiment === "bad") stats.negativeCount++;
          else stats.neutralCount++;

          // Upgrade impact level if this news is higher
          if (impact === "high") {
            stats.highestImpact = "high";
          } else if (impact === "medium" && stats.highestImpact !== "high") {
            stats.highestImpact = "medium";
          }
        }
      }

      // Map map to TickerAnalysis array
      const trendingList = Array.from(tickerMap.values()).map((stats) => {
        // Net sentiment determination
        let sentiment: "up" | "down" | "flat" = "flat";
        if (stats.positiveCount > stats.negativeCount) {
          sentiment = "up";
        } else if (stats.negativeCount > stats.positiveCount) {
          sentiment = "down";
        }

        // Calculate score: percentage of net sentiment or simple score
        const totalSentiments =
          stats.positiveCount + stats.negativeCount + stats.neutralCount;
        const score =
          totalSentiments > 0
            ? Math.round(
                ((stats.positiveCount - stats.negativeCount) /
                  totalSentiments) *
                  100,
              )
            : 0;

        return {
          symbol: stats.symbol,
          name: `Mentions: ${stats.mentionCount}`,
          impactLevel: stats.highestImpact,
          sentiment,
          mentionCount: stats.mentionCount,
          sentimentHistorical: {
            positive: stats.positiveCount,
            negative: stats.negativeCount,
            neutral: stats.neutralCount,
          },
          score,
        };
      });

      // Sort by mentionCount descending, then by absolute score descending
      trendingList.sort(
        (a, b) =>
          b.mentionCount - a.mentionCount ||
          Math.abs(b.score) - Math.abs(a.score),
      );

      return NextResponse.json({ success: true, data: trendingList });
    }

    if (action === "quote") {
      const symbol = searchParams.get("symbol");
      if (!symbol)
        return NextResponse.json(
          { success: false, error: "Symbol required" },
          { status: 400 },
        );
      const data = await fetchQuote(symbol);
      return NextResponse.json({ success: true, data });
    }

    // Default to 'news' action
    const now = Date.now();
    // Auto-scrape in the background if 3 minutes have passed
    if (!isScraping && now - lastScrapeTime > 3 * 60 * 1000) {
      isScraping = true;
      lastScrapeTime = now;
      console.log("[API] Triggering background news scrape...");
      scrapeAndStoreNews()
        .catch((err) => console.error("[API] Scrape error:", err))
        .finally(() => {
          isScraping = false;
          console.log("[API] Background scrape completed.");
        });
    }

    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const skip = (page - 1) * limit;

    const news = await prisma.news.findMany({
      orderBy: { publishedAt: "desc" },
      take: limit,
      skip: skip,
    });

    const formattedNews = news.map((item) => {
      const parsedSentiment =
        item.sentiment === "good"
          ? "good"
          : item.sentiment === "bad"
            ? "bad"
            : "neutral";
      const tickerSentiment =
        parsedSentiment === "good"
          ? "up"
          : parsedSentiment === "bad"
            ? "down"
            : "flat";

      let countryCode = item.countryCode || "global";
      let regionTag = item.regionTag || "global";

      if (countryCode === "global") {
        const headlineLower = item.headline.toLowerCase();
        if (
          headlineLower.match(
            /\b(us|usa|u\.s\.|america|american|fed|federal reserve|congress|sec|biden|trump|wall st|ny|new york|san francisco|california|nasdaq|s&p 500|dow jones)\b/,
          )
        ) {
          countryCode = "us";
        } else if (
          headlineLower.match(/\b(cn|china|chinese|beijing|shanghai|yuan)\b/)
        ) {
          countryCode = "cn";
        } else if (headlineLower.match(/\b(jp|japan|japanese|tokyo|yen)\b/)) {
          countryCode = "jp";
        } else if (
          headlineLower.match(/\b(de|germany|german|berlin|frankfurt|dax)\b/)
        ) {
          countryCode = "de";
        } else if (
          headlineLower.match(
            /\b(gb|uk|united kingdom|britain|british|london|boe|sterling|burnham|manchester)\b/,
          )
        ) {
          countryCode = "gb";
        } else if (headlineLower.match(/\b(fr|france|french|paris)\b/)) {
          countryCode = "fr";
        } else if (
          headlineLower.match(/\b(in|india|indian|mumbai|delhi|rupee)\b/)
        ) {
          countryCode = "in";
        } else if (headlineLower.match(/\b(it|italy|italian|rome|milan)\b/)) {
          countryCode = "it";
        } else if (headlineLower.match(/\b(br|brazil|brazilian|rio)\b/)) {
          countryCode = "br";
        } else if (headlineLower.match(/\b(ca|canada|canadian|toronto)\b/)) {
          countryCode = "ca";
        } else if (headlineLower.match(/\b(kr|korea|korean|seoul)\b/)) {
          countryCode = "kr";
        } else if (
          headlineLower.match(/\b(au|australia|australian|sydney|melbourne)\b/)
        ) {
          countryCode = "au";
        } else if (headlineLower.match(/\b(es|spain|spanish|madrid)\b/)) {
          countryCode = "es";
        } else if (headlineLower.match(/\b(mx|mexico|mexican)\b/)) {
          countryCode = "mx";
        } else if (
          headlineLower.match(/\b(nl|netherlands|dutch|amsterdam)\b/)
        ) {
          countryCode = "nl";
        } else if (headlineLower.match(/\b(ch|switzerland|swiss|zurich)\b/)) {
          countryCode = "ch";
        } else if (
          headlineLower.match(/\b(tw|taiwan|taiwanese|taipei|tsmc)\b/)
        ) {
          countryCode = "tw";
        } else if (headlineLower.match(/\b(th|thailand|thai|bangkok)\b/)) {
          countryCode = "th";
        } else if (headlineLower.match(/\b(sg|singapore|singaporean)\b/)) {
          countryCode = "sg";
        } else if (headlineLower.match(/\b(ie|ireland|irish|dublin)\b/)) {
          countryCode = "ie";
        } else if (headlineLower.match(/\b(be|belgium|belgian|brussels)\b/)) {
          countryCode = "be";
        } else if (headlineLower.match(/\b(no|norway|norwegian|oslo)\b/)) {
          countryCode = "no";
        } else if (headlineLower.match(/\b(dk|denmark|danish|copenhagen)\b/)) {
          countryCode = "dk";
        }

        const regionMap: Record<string, string> = {
          us: "us",
          cn: "asia",
          jp: "asia",
          in: "asia",
          kr: "asia",
          tw: "asia",
          th: "asia",
          sg: "asia",
          de: "eu",
          gb: "eu",
          fr: "eu",
          it: "eu",
          es: "eu",
          nl: "eu",
          ch: "eu",
          ie: "eu",
          be: "eu",
          no: "eu",
          dk: "eu",
          br: "global",
          ca: "us",
          mx: "global",
        };
        regionTag = regionMap[countryCode] || "global";
      }

      return {
        ...item,
        category: item.category as Category,
        sentiment: parsedSentiment,
        countryCode,
        regionTag: regionTag as RegionTab,
        tickers: JSON.parse(item.tickers as string).map((t: any) =>
          typeof t === "string"
            ? {
                symbol: t,
                name: t,
                sentiment: tickerSentiment,
                sentimentScore:
                  parsedSentiment === "good"
                    ? 8
                    : parsedSentiment === "bad"
                      ? 2
                      : 5,
              }
            : t,
        ),
        sources: JSON.parse(item.sources as string),
        publishedAt: item.publishedAt.toISOString(),
      };
    });

    return NextResponse.json({ success: true, data: formattedNews });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}
