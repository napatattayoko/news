import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Global in-memory cache to prevent Yahoo Finance / Finviz network bottlenecks
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const priceCache = new Map<string, CacheEntry<{ dailyChanges: Record<string, number>; closes: number[]; history: { timestamp: number; close: number; }[]; currentPrice: number | null }>>();
const singlePriceCache = new Map<string, CacheEntry<number | null>>();
const CACHE_TTL = 15 * 60 * 1000;      // 15 minutes cache for successful fetches
const NEGATIVE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache for failed fetches

// ─── Server-side result cache (additive — prevents redundant DB + Yahoo Finance calls) ───
interface ResultCacheEntry { data: any[]; ts: number; }
const resultCache = new Map<string, ResultCacheEntry>();
const RESULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
      "24h": { range: "2d", interval: "1d" },
      "7d": { range: "7d", interval: "1d" },
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
        const opens = result.indicators.quote[0].open as (number | null)[];

        if (range === "24h") {
          const latestClose = closes[closes.length - 1];
          const latestOpen = opens[opens.length - 1];
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
async function fetchDailyPriceChanges(symbol: string, range: string): Promise<{ dailyChanges: Record<string, number>; closes: number[]; history: { timestamp: number; close: number; }[]; currentPrice: number | null }> {
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
  const history: { timestamp: number; close: number }[] = [];
  let currentPrice: number | null = null;
  try {
    const yfRangeMap: Record<string, { range: string; interval: string }> = {
      "24h": { range: "7d", interval: "1d" }, // ensure at least 4‑day data for 3‑day forward
      "7d": { range: "1mo", interval: "1d" },
      "30d": { range: "3mo", interval: "1d" },
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
        currentPrice = result.meta?.regularMarketPrice ?? null;
        const timestamps = result.timestamp as number[];
        const closes = result.indicators.quote[0].close as (number | null)[];
        const opens = result.indicators.quote[0].open as (number | null)[];

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
              history.push({ timestamp: timestamps[i] * 1000, close });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[Daily Price Chart] Error fetching for ${symbol}:`, err);
  }

  const resultData = { dailyChanges, closes: closesList, history, currentPrice };
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

    // ── Result cache check (additive — logic below untouched) ────────────────
    const resultCacheKey = `sentiment-${range}-${symbolsParam ?? "all"}`;
    const cachedResult = resultCache.get(resultCacheKey);
    if (cachedResult && Date.now() - cachedResult.ts < RESULT_CACHE_TTL) {
      return NextResponse.json({ success: true, data: cachedResult.data });
    }

    // ── Validate range parameter ─────────────────────────────────────────
    const ALLOWED_RANGES = new Set(["24h", "7d", "30d"]);
    if (!ALLOWED_RANGES.has(range)) {
      return NextResponse.json(
        { success: false, error: `Invalid range "${range}". Allowed: 24h, 7d, 30d` },
        { status: 400 }
      );
    }

    let cutoffDate: Date | null = null;
    // Since dynamic candles is up to 7 days, we fetch history far enough back to calculate 7 days of future price action
    if (range === "24h") {
      cutoffDate = new Date(Date.now() - (1 + 7 * 2) * 24 * 60 * 60 * 1000);
    } else if (range === "7d") {
      cutoffDate = new Date(Date.now() - (7 + 14) * 24 * 60 * 60 * 1000);
    } else {
      cutoffDate = new Date(Date.now() - (30 + 14) * 24 * 60 * 60 * 1000);
    }

    let filterSymbols: Set<string> | null = null;
    if (symbolsParam) {
      filterSymbols = new Set(symbolsParam.split(",").map((s) => s.trim().toUpperCase()));
    }

    // ── 1. Fetch all news in the selected range ──────────────────────────
    // Only select lightweight fields needed for aggregation.
    // Excludes: headline, body, sources (heavy text fields unused in scoring).
    const newsItems = await prisma.news.findMany({
      where: cutoffDate ? { publishedAt: { gte: cutoffDate } } : {},
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        publishedAt: true,
        sentiment: true,
        impact: true,
        tickers: true,
      },
    });

    const results: any[] = [];
    const matchedSymbols = new Set<string>();

    // Cache price changes in-request to prevent duplicate fetch calls
    const priceChangesCache = new Map<string, { dailyChanges: Record<string, number>; closes: number[]; history: { timestamp: number; close: number }[]; currentPrice: number | null }>();

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
      } catch (err) { }
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
            priceChangesCache.set(symbol, { dailyChanges: {}, closes: [], history: [], currentPrice: null });
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
        oldestNewsDate: string | null;
        priceTrend: number[];
        priceHistory: { timestamp: number; close: number }[];
        currentPrice: number | null;
        dailyStats: Record<string, {
          positive: number;
          negative: number;
          neutral: number;
          count: number;
          impacts: Record<string, number>;
          posCount: number;
          negCount: number;
          neuCount: number;
        }>;
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
            oldestNewsDate: null,
            priceTrend: [],
            priceHistory: [],
            currentPrice: null,
            dailyStats: {},
          });
        }
        const group = groupedMap.get(symbol)!;

        const priceData = priceChangesCache.get(symbol) ?? { dailyChanges: {}, closes: [], history: [], currentPrice: null };
        const dailyPriceChanges = priceData.dailyChanges;

        if (group.priceTrend.length === 0) {
          group.priceTrend = priceData.closes;
          group.priceHistory = priceData.history;
          group.currentPrice = priceData.currentPrice;
        }

        const dateKey = news.publishedAt.toLocaleDateString("en-US", {
          timeZone: "America/New_York",
        });

        const newsImpact = news.impact === "high" ? "high" : news.impact === "medium" ? "medium" : "low";
        const impactLevel: "high" | "medium" | "low" = newsImpact;

        let impactMultiplier = 0.4;
        if (impactLevel === "high") impactMultiplier = 2.5;
        else if (impactLevel === "medium") impactMultiplier = 1.2;

        // We will just use count of news for majority vote as requested by user.
        // No time decay weighting.
        if (news.sentiment === "good") {
          group.posCount += 1;
        } else if (news.sentiment === "bad") {
          group.negCount += 1;
        } else {
          group.neuCount += 1;
        }

        group.count += 1;
        if (!group.latestNewsDate || new Date(news.publishedAt) > new Date(group.latestNewsDate)) {
          group.latestNewsDate = news.publishedAt.toISOString();
        }
        if (!group.oldestNewsDate || new Date(news.publishedAt) < new Date(group.oldestNewsDate)) {
          group.oldestNewsDate = news.publishedAt.toISOString();
        }

        group.impacts[impactLevel] = (group.impacts[impactLevel] || 0) + 1;

        // Populate daily stats
        if (!group.dailyStats[dateKey]) {
          group.dailyStats[dateKey] = {
            positive: 0, negative: 0, neutral: 0,
            count: 0,
            impacts: { high: 0, medium: 0, low: 0 },
            posCount: 0, negCount: 0, neuCount: 0
          };
        }
        const daily = group.dailyStats[dateKey];
        if (news.sentiment === "good") { daily.posCount += 1; }
        else if (news.sentiment === "bad") { daily.negCount += 1; }
        else { daily.neuCount += 1; }
        daily.count += 1;
        daily.impacts[impactLevel] = (daily.impacts[impactLevel] || 0) + 1;

        // (per-news accuracy removed — accuracy is now computed at the symbol level
        //  by comparing the final Score against the actual price change over the range)
      }
    }

    for (const [symbol, group] of groupedMap.entries()) {
      // Majority logic based on raw counts
      const maxSentimentVal = Math.max(group.posCount, group.negCount, group.neuCount);
      let majoritySentiment = "flat";
      if (maxSentimentVal === group.posCount && maxSentimentVal > 0) majoritySentiment = "up";
      else if (maxSentimentVal === group.negCount && maxSentimentVal > 0) majoritySentiment = "down";

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

      // ── Build Daily Breakdown if applicable ─────────────────────────
      let dailyBreakdown: any[] | undefined = undefined;
      let averageDailyScore = finalScore;
      if (range === '7d' || range === '30d') {
        const priceData = priceChangesCache.get(symbol) ?? { dailyChanges: {} };
        const dailyPriceChanges = priceData.dailyChanges as Record<string, number>;
        dailyBreakdown = Object.entries(group.dailyStats).map(([date, stats]) => {
          const maxSent = Math.max(stats.posCount, stats.negCount, stats.neuCount);
          let sent: 'up' | 'down' | 'flat' = 'flat';
          if (maxSent === stats.posCount && maxSent > 0) sent = 'up';
          else if (maxSent === stats.negCount && maxSent > 0) sent = 'down';

          const maxImp = Math.max(stats.impacts.high, stats.impacts.medium, stats.impacts.low);
          let imp: 'high' | 'medium' | 'low' = 'low';
          if (maxImp === stats.impacts.high && maxImp > 0) imp = 'high';
          else if (maxImp === stats.impacts.medium && maxImp > 0) imp = 'medium';

          return {
            date,
            sentiment: sent,
            impactLevel: imp,
            score: getNewsScore(sent, imp),
            mentionCount: stats.count,
            sentimentHistorical: {
              positive: stats.posCount,
              negative: stats.negCount,
              neutral: stats.neuCount,
            }
          };
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (dailyBreakdown.length > 0) {
          const totalScore = dailyBreakdown.reduce((sum, day) => sum + day.score, 0);
          averageDailyScore = totalScore / dailyBreakdown.length;
        }
      }

      // ── Accuracy: Compare Score direction vs actual price change over the range ──
      let accuracy: number | null = null;
      let parentStatStartDate: string | null = null;
      let parentStatStartPrice: number | null = null;
      let parentStatEndDate: string | null = null;
      let parentStatEndPrice: number | null = null;
      const history = group.priceHistory;

      // The user wants the parent row to use a dynamic window starting from the latest news date.
      const dynamicTargetCandles = majorityImpact === 'high' ? 3 : 7;
      let startEntry = null;
      let endEntry = null;
      let isEarly = false;

      if (group.latestNewsDate && history && history.length > 0) {
        // Strip hours to match history timestamps (which are UTC midnights)
        const dateStr = new Date(group.latestNewsDate).toLocaleDateString("en-US", { timeZone: "America/New_York" });
        const [m, d, y] = dateStr.split('/');
        const latestDateMidnight = Date.UTC(Number(y), Number(m) - 1, Number(d));
        
        startEntry = history.find(entry => entry.timestamp >= latestDateMidnight);
        if (startEntry) {
          const startIndex = history.indexOf(startEntry);
          if (startIndex + dynamicTargetCandles < history.length) {
            endEntry = history[startIndex + dynamicTargetCandles];
          } else {
            // If dynamic target candles not reached, use the latest available price
            endEntry = history[history.length - 1];
            isEarly = true;
          }
        }
      }

      if (startEntry && endEntry) {
        const firstClose = startEntry.close;
        const lastClose = isEarly && group.currentPrice != null ? group.currentPrice : endEntry.close;
        
        parentStatStartDate = new Date(startEntry.timestamp).toISOString();
        parentStatStartPrice = firstClose;
        parentStatEndDate = isEarly && group.currentPrice != null ? new Date().toISOString() : new Date(endEntry.timestamp).toISOString();
        parentStatEndPrice = lastClose;
      }

      // Calculate daily breakdown accuracies
      if (history && history.length > 0 && dailyBreakdown) {
        const dailyAccuracies: number[] = [];

        for (const day of dailyBreakdown) {
          // Parse date as UTC to prevent server's local timezone from shifting it back by 7 hours
          let dayDate = 0;
          if (day.date && day.date.includes('/')) {
            const [m, d, y] = day.date.split('/');
            dayDate = Date.UTC(Number(y), Number(m) - 1, Number(d));
          } else {
            dayDate = new Date(day.date).getTime();
          }

          const nowTime = Date.now();
          const daysSinceNews = (nowTime - dayDate) / (1000 * 60 * 60 * 24);

          // Calculate accuracy based on trading days (candles) instead of calendar days
          // Find the start price (price on or just after the news date)
          const startEntry = history.find(entry => entry.timestamp >= dayDate);

          if (startEntry) {
            const startIndex = history.indexOf(startEntry);

            const childTargetCandles = day.impactLevel === 'high' ? 3 : 7;
            let endEntry;
            let isEarly = false;

            if (startIndex + childTargetCandles < history.length) {
              endEntry = history[startIndex + childTargetCandles];
            } else {
              // Target candles haven't appeared yet, fallback to the latest available candle
              endEntry = history[history.length - 1];
              isEarly = true;
            }

            if (endEntry) {
              // Note: Using 'America/New_York' consistently for dates as that is the trading timezone
              const endDateObj = isEarly && group.currentPrice != null ? new Date() : new Date(endEntry.timestamp);
              day.endDate = endDateObj.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
              
              day.startPrice = startEntry.close;
              day.endPrice = isEarly && group.currentPrice != null ? group.currentPrice : endEntry.close;

              const startClose = day.startPrice;
              const endClose = day.endPrice;
              const pctChange = ((endClose - startClose) / startClose) * 100;
              const score = day.score;

              const PRICE_DEADZONE = 0.5; // percent
              const SCORE_DEADZONE = 1.0;

              let priceDir = 0;
              if (pctChange > PRICE_DEADZONE) priceDir = 1;
              else if (pctChange < -PRICE_DEADZONE) priceDir = -1;

              let sentDir = 0;
              if (day.sentiment === 'up' || day.sentiment === 'positive') sentDir = 1;
              else if (day.sentiment === 'down' || day.sentiment === 'negative') sentDir = -1;

              let dayAccuracy = 50;
              
              if (sentDir === 0 && priceDir === 0) {
                dayAccuracy = 50;
              } else if (sentDir !== 0 && priceDir === 0) {
                dayAccuracy = 50;
              } else if (sentDir === priceDir) {
                // Rely purely on percentage change (cap at 5%)
                const priceStrength = Math.min(Math.abs(pctChange) / 5, 1);
                dayAccuracy = Math.round(50 + priceStrength * 50);
              } else {
                const isOpposite = Math.abs(sentDir - priceDir) === 2;
                const conflictMultiplier = isOpposite ? 1.0 : 0.75;
                
                // Rely purely on percentage change (cap at 5%)
                const priceStrength = Math.min(Math.abs(pctChange) / 5, 1);
                const conflictScore = priceStrength * conflictMultiplier;
                dayAccuracy = Math.round(50 - conflictScore * 50);
              }

              // Store raw accuracy temporarily
              (day as any)._rawAccuracy = dayAccuracy;
            } else {
              (day as any)._rawAccuracy = null;
            }
          } else {
            (day as any)._rawAccuracy = null;
          }
        }

        // Calculate cumulative accuracy from oldest to newest for the parent row
        let runningSum = 0;
        let validCount = 0;
        let finalCumulativeAccuracy: number | null = null;
        for (let i = dailyBreakdown.length - 1; i >= 0; i--) {
          const day = dailyBreakdown[i];
          if ((day as any)._rawAccuracy != null) {
            runningSum += (day as any)._rawAccuracy;
            validCount++;
            finalCumulativeAccuracy = Math.round(runningSum / validCount);
            day.accuracy = (day as any)._rawAccuracy; // Child row shows its OWN raw accuracy
            dailyAccuracies.unshift(day.accuracy);
          } else {
            day.accuracy = null;
          }
          delete (day as any)._rawAccuracy;
        }

        // Calculate Parent Row STAT as the cumulative average of the latest day
        const validStats = dailyBreakdown.filter(d => d.accuracy != null);
        if (validStats.length > 0) {
          const latestValid = validStats[0];
          accuracy = finalCumulativeAccuracy; // Parent row shows the cumulative average
          
          // Use the latest child row that actually has a STAT to represent the parent row's START date and price
          let validDateMs;
          if (latestValid.date.includes('/')) {
            const [m, d, y] = latestValid.date.split('/');
            // Set to 12:00 UTC so timezone shifts (-5 or +7) don't change the date
            validDateMs = Date.UTC(Number(y), Number(m) - 1, Number(d), 12);
          } else {
            validDateMs = new Date(latestValid.date).getTime();
          }

          parentStatStartDate = new Date(validDateMs).toISOString();
          parentStatStartPrice = latestValid.startPrice;
          
          // End date and price should be the CURRENT real-time data
          parentStatEndDate = new Date().toISOString();
          if (group.currentPrice != null) {
            parentStatEndPrice = group.currentPrice;
          } else if (history && history.length > 0) {
            parentStatEndPrice = history[history.length - 1].close;
          } else {
            parentStatEndPrice = latestValid.endPrice;
          }
        } else {
          accuracy = null; // No historical data matching the sentiment completed yet
        }
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
        parentStatStartDate,
        parentStatStartPrice,
        parentStatEndDate,
        parentStatEndPrice,
        priceTrend: group.priceTrend,
        dailyBreakdown,
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
            } catch { }
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

    // Store in result cache before returning
    resultCache.set(resultCacheKey, { data: results, ts: Date.now() });

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error("[Sentiment API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

