import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Global in-memory cache to prevent Yahoo Finance / Finviz network bottlenecks
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const priceCache = new Map<string, CacheEntry<{ dailyChanges: Record<string, number>; closes: number[] }>>();
const singlePriceCache = new Map<string, CacheEntry<number | null>>();
const CACHE_TTL = 15 * 60 * 1000;      // 15 minutes cache for successful fetches
const NEGATIVE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache for failed fetches

// ─── Helper: Fetch overall price change % for the range (with Finviz fallback) ──
async function fetchPriceChange(symbol: string, range: string): Promise<number | null> {
  const cacheKey = `${symbol}-${range}`;
  const cached = singlePriceCache.get(cacheKey);
  if (cached) {
    const isErrorCache = cached.data === null;
    const ttl = isErrorCache ? NEGATIVE_CACHE_TTL : CACHE_TTL;
    if (Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }

  let finalPct: number | null = null;
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
            finalPct = ((latestClose - latestOpen) / latestOpen) * 100;
          } else {
            const liveChange = result.meta?.regularMarketChangePercent;
            if (liveChange != null) finalPct = liveChange;
          }
        } else {
          const firstOpen = opens.find((v) => v != null);
          const lastClose = [...closes].reverse().find((v) => v != null);
          if (firstOpen != null && lastClose != null && firstOpen !== 0) {
            finalPct = ((lastClose - firstOpen) / firstOpen) * 100;
          }
        }
      }
    }
  } catch { /* fall through to Finviz */ }

  if (finalPct === null) {
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
            finalPct = pct;
          }
        }
      }
    } catch { /* ignore */ }
  }

  singlePriceCache.set(cacheKey, { data: finalPct, timestamp: Date.now() });
  return finalPct;
}

// ─── Helper: Fetch daily price change map for standard dates ───
async function fetchDailyPriceChanges(symbol: string, range: string): Promise<{ dailyChanges: Record<string, number>; closes: number[] }> {
  const cacheKey = `${symbol}-${range}`;
  const cached = priceCache.get(cacheKey);
  if (cached) {
    const isErrorCache = Object.keys(cached.data.dailyChanges).length === 0 && cached.data.closes.length === 0;
    const ttl = isErrorCache ? NEGATIVE_CACHE_TTL : CACHE_TTL;
    if (Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }

  const dailyChanges: Record<string, number> = {};
  const closesList: number[] = [];
  try {
    const yfRangeMap: Record<string, { range: string; interval: string }> = {
      "24h": { range: "5d",  interval: "1d" },
      "7d":  { range: "10d", interval: "1d" },
      "30d": { range: "45d", interval: "1d" },
    };
    const yfParams = yfRangeMap[range] ?? { range: "5d", interval: "1d" };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${yfParams.range}&interval=${yfParams.interval}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
        next: { revalidate: 3600 },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

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
              closesList.push(close);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[Daily Price Chart] Error fetching for ${symbol}:`, err);
  }

  const resultData = { dailyChanges, closes: closesList };
  priceCache.set(cacheKey, { data: resultData, timestamp: Date.now() });
  return resultData;
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
      take: 2000, // Limit to prevent memory exhaustion
    });

    const results: any[] = [];
    const matchedSymbols = new Set<string>();

    // Cache price changes in-request to prevent duplicate fetch calls
    const priceChangesCache = new Map<string, { dailyChanges: Record<string, number>; closes: number[] }>();

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
      } catch (err) {}
    }

    // Fetch all price changes in batches of 10
    const symbolsArray = Array.from(uniqueSymbols);
    for (let i = 0; i < symbolsArray.length; i += 10) {
      const batch = symbolsArray.slice(i, i + 10);
      await Promise.all(
        batch.map(async (symbol) => {
          try {
            const data = await fetchDailyPriceChanges(symbol, range);
            priceChangesCache.set(symbol, data);
          } catch (err) {
            console.error(`[Pre-fetch Price Error] Failed for ${symbol}:`, err);
            priceChangesCache.set(symbol, { dailyChanges: {}, closes: [] });
          }
        })
      );
    }

    const groupedMap = new Map<
      string,
      {
        count: number;
        sumPriceScore: number;
        totalNewsVal: number;
        impacts: Record<string, number>;
        positive: number;
        negative: number;
        neutral: number;
        posCount: number;
        negCount: number;
        neuCount: number;
        latestNewsDate: string | null;
        priceTrend: number[];
        // Per-news accuracy tracking: each entry = { rawAccuracy: 0-70, publishedAt: Date }
        accuracyEntries: Array<{ rawAccuracy: number; publishedAt: Date }>;
      }
    >();

    // ── 2. Generate one row per news article per ticker ──────────────────
    for (const news of newsItems) {
      let tickersList: string[] = [];
      try {
        const parsed = JSON.parse(news.tickers as string) || [];
        tickersList = parsed.map((t: any) => (typeof t === "string" ? t : t.symbol).toUpperCase());
      } catch (err) {
        continue;
      }

      // If filter is active, only include matching symbols for this news item
      const activeTickers = filterSymbols 
        ? tickersList.filter(t => filterSymbols!.has(t))
        : tickersList;

      for (const symbol of activeTickers) {
        matchedSymbols.add(symbol);

        if (!groupedMap.has(symbol)) {
          groupedMap.set(symbol, {
            count: 0,
            sumPriceScore: 0,
            totalNewsVal: 0,
            impacts: { high: 0, medium: 0, low: 0 },
            positive: 0,
            negative: 0,
            neutral: 0,
            posCount: 0,
            negCount: 0,
            neuCount: 0,
            latestNewsDate: null,
            priceTrend: [],
            accuracyEntries: [],
          });
        }
        const group = groupedMap.get(symbol)!;

        // Retrieve pre-fetched price changes instantly
        const priceData = priceChangesCache.get(symbol) ?? { dailyChanges: {}, closes: [] };
        const dailyPriceChanges = priceData.dailyChanges;
        
        if (group.priceTrend.length === 0) {
          group.priceTrend = priceData.closes;
        }

        const dateKey = news.publishedAt.toLocaleDateString("en-US", {
          timeZone: "America/New_York",
        });

        // Determine if price had huge swing
        let priceMagnitudeImpact: "high" | "medium" | "low" = "low";
        if (dailyPriceChanges[dateKey] !== undefined) {
          const absPct = Math.abs(dailyPriceChanges[dateKey]);
          if (absPct >= 3.5) priceMagnitudeImpact = "high";
          else if (absPct >= 2.0) priceMagnitudeImpact = "medium";
        }

        const impactRank = { high: 3, medium: 2, low: 1 };
        const newsImpact = news.impact === "high" ? "high" : news.impact === "medium" ? "medium" : "low";
        const impactLevel: "high" | "medium" | "low" =
          impactRank[priceMagnitudeImpact] >= impactRank[newsImpact]
            ? (priceMagnitudeImpact as "high" | "medium" | "low")
            : (newsImpact as "high" | "medium" | "low");

        let impactMultiplier = 0.4;
        if (impactLevel === "high") impactMultiplier = 2.5;
        else if (impactLevel === "medium") impactMultiplier = 1.2;

        // ── Time-weighted voting: fresh news has more influence ──────────
        function getTimeWeight(publishedAt: Date): number {
          const hoursOld = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
          if (hoursOld < 12) return 1.0;   // 0-12 hours: full weight
          if (hoursOld < 72) return 0.3;   // 1-3 days: 30% weight
          return 0.02;                      // 4-7+ days: 2% weight (almost expired)
        }

        const timeW = getTimeWeight(news.publishedAt);
        const combinedWeight = timeW * impactMultiplier;

        if (news.sentiment === "good") {
          group.positive += combinedWeight;
          group.posCount += 1;
          group.sumPriceScore += 1 * combinedWeight;
          group.totalNewsVal += combinedWeight;
        } else if (news.sentiment === "bad") {
          group.negative += combinedWeight;
          group.negCount += 1;
          group.sumPriceScore += -1 * combinedWeight;
          group.totalNewsVal += combinedWeight;
        } else {
          group.neutral += combinedWeight;
          group.neuCount += 1;
          group.sumPriceScore += 0;
          group.totalNewsVal += combinedWeight;
        }

        group.count += 1;
        if (!group.latestNewsDate || new Date(news.publishedAt) > new Date(group.latestNewsDate)) {
          group.latestNewsDate = news.publishedAt.toISOString();
        }

        group.impacts[impactLevel] = (group.impacts[impactLevel] || 0) + combinedWeight;

        // ── Per-news accuracy (raw, before time decay) ──────────────────
        // Only calculate if we have price data for that day
        if (dailyPriceChanges[dateKey] !== undefined) {
          const pricePct = dailyPriceChanges[dateKey]; // positive = price up, negative = price down
          const scoreDir = news.sentiment === "good" ? 1 : news.sentiment === "bad" ? -1 : 0;
          const priceDir = pricePct > 0.3 ? 1 : pricePct < -0.3 ? -1 : 0; // ±0.3% deadzone

          // Direction match: 0 or 40 pts
          let dirPts = 0;
          if (scoreDir === 0 && priceDir === 0) dirPts = 40; // neutral + flat = correct
          else if (scoreDir === priceDir && scoreDir !== 0) dirPts = 40;

          // Magnitude match: 0 or 30 pts (Only calculated if direction matched!)
          let magPts = 0;
          if (dirPts > 0) {
            const absPct = Math.abs(pricePct);
            const scoreAbsLevel = newsImpact; // high/medium/low already computed above
            if (scoreAbsLevel === 'high' && absPct >= 2) magPts = 30;
            else if (scoreAbsLevel === 'medium' && absPct >= 1) magPts = 30;
            else if (scoreAbsLevel === 'low' && absPct < 1) magPts = 30;
          }

          group.accuracyEntries.push({
            rawAccuracy: dirPts + magPts, // 0 (if wrong direction) or 40-70 (if correct)
            publishedAt: news.publishedAt,
          });
        }
      }
    }

    for (const [symbol, group] of groupedMap.entries()) {
      // Majority logic
      const maxSentimentVal = Math.max(group.positive, group.negative, group.neutral);
      let majoritySentiment = "flat";
      if (maxSentimentVal === group.positive && maxSentimentVal > 0) majoritySentiment = "up";
      else if (maxSentimentVal === group.negative && maxSentimentVal > 0) majoritySentiment = "down";

      const maxImpactVal = Math.max(group.impacts.high, group.impacts.medium, group.impacts.low);
      let majorityImpact = "low";
      if (maxImpactVal === group.impacts.high && maxImpactVal > 0) majorityImpact = "high";
      else if (maxImpactVal === group.impacts.medium && maxImpactVal > 0) majorityImpact = "medium";

      const getNewsScore = (s: string, imp: string): number => {
        const isDirectional = s === 'up' || s === 'down';
        let absScore = 0;
        if (isDirectional) {
          if (imp === 'high') absScore = 10;
          else if (imp === 'medium') absScore = 8;
          else absScore = 6;
        } else {
          if (imp === 'high') absScore = 5;
          else if (imp === 'medium') absScore = 3;
          else absScore = 1;
        }
        return s === 'down' ? -absScore : absScore;
      };

      const finalScore = getNewsScore(majoritySentiment, majorityImpact);

      // ── Accuracy with Time Decay ─────────────────────────────────────
      // Time decay factor based on age of each news item
      function getTimePts(publishedAt: Date): number {
        const hoursOld = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
        if (hoursOld < 6)   return 30;
        if (hoursOld < 12)  return 24;
        if (hoursOld < 24)  return 18;
        if (hoursOld < 72)  return 9;   // 1-3 days
        if (hoursOld < 168) return 3;   // 3-7 days
        return 1; // >7 days: minimal but not zero (history still counts a little)
      }

      let accuracy: number | null = null;
      if (group.accuracyEntries.length > 0) {
        // Weighted average: each news item's accuracy (0-100%) is multiplied by its time decay weight
        let weightedSum = 0;
        let weightTotal = 0;
        for (const entry of group.accuracyEntries) {
          const timePts = getTimePts(entry.publishedAt);
          // Normalize time weight to 0.03 - 1.0 scale
          const timeWeight = timePts / 30;
          // Convert raw accuracy (0-70) to percentage (0-100%)
          const normalizedAccuracy = (entry.rawAccuracy / 70) * 100;
          weightedSum += normalizedAccuracy * timeWeight;
          weightTotal += timeWeight;
        }
        accuracy = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;
      }

      results.push({
        id: symbol,
        symbol,
        impactLevel: majorityImpact,
        sentiment: majoritySentiment,
        mentionCount: group.count,
        score: finalScore,
        accuracy,
        sentimentHistorical: {
          positive: group.posCount,
          negative: group.negCount,
          neutral: group.neuCount,
        },
        latestNewsDate: group.latestNewsDate,
        priceTrend: group.priceTrend,
      });
    }

    // ── 3. Fallback: Generate overall price action for symbols with 0 news if symbolsParam is set ──
    if (filterSymbols) {
      const fallbackPromises = Array.from(filterSymbols).map(async (symbol) => {
        if (!matchedSymbols.has(symbol)) {
          const priceChangePercent = await fetchPriceChange(symbol, range);
          const priceScore =
            priceChangePercent != null
              ? clamp(Math.round(priceChangePercent * 2), -10, 10)
              : 0;

          const fallbackSentiment = priceScore > 0 ? "up" : priceScore < 0 ? "down" : "flat";
          const absFallback = Math.abs(priceScore);
          const fallbackImpact = absFallback >= 7 ? "high" : absFallback >= 4 ? "medium" : "low";

          const priceData = priceChangesCache.get(symbol) ?? { dailyChanges: {}, closes: [] };
          let trendCloses = priceData.closes;
          if (trendCloses.length === 0) {
            try {
              const data = await fetchDailyPriceChanges(symbol, range);
              trendCloses = data.closes;
            } catch {}
          }

          results.push({
            id: `fallback-${symbol}`,
            symbol,
            impactLevel: fallbackImpact,
            sentiment: fallbackSentiment,
            mentionCount: 0,
            score: priceScore,
            sentimentHistorical: { positive: 0, negative: 0, neutral: 0 },
            latestNewsDate: null,
            priceTrend: trendCloses,
          });
        }
      });
      await Promise.all(fallbackPromises);
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

