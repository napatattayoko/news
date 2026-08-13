export type SentimentResult = 'good' | 'neutral' | 'bad';
export type ImpactResult = 'high' | 'medium' | 'low';

export interface AIAnalysisResult {
  pass: boolean;
  reason: string;
  category: string;
  sentiment: SentimentResult;
  impact: ImpactResult;
}

async function fetchGeminiWithRetry(url: string, body: any, maxRetries = 10): Promise<Response> {
  let retries = maxRetries;
  let delay = 6000; // Start with 6s sleep

  while (retries > 0) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (Number(response.status) === 429) {
      console.warn(`[AI] Gemini rate limited (429). Retrying in ${delay / 1000}s... (Retries left: ${retries - 1})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries--;
      delay = Math.min(delay * 2, 60000); // Exponential backoff up to 60s max
      continue;
    }

    return response;
  }

  throw new Error("Exceeded maximum retries for Gemini API due to rate limits.");
}

export async function analyzeArticle(headline: string, body: string): Promise<AIAnalysisResult> {
  const textToAnalyze = headline.substring(0, 500);

  const prompt = `You are a strict Quantitative Trader and Financial Sentiment Analyst. Analyze this news headline and determine its IMMEDIATE price action impact on the underlying stock or market index.

Output a JSON object EXACTLY matching this schema:
{
  "pass": true|false,
  "reason": "brief explanation of market impact and expected price reaction",
  "category": "markets"|"economy"|"geopolitics"|"tech"|"ai"|"energy"|"commodities"|"healthcare"|"real-estate"|"climate"|"defense"|"banking"|"automotive"|"trade"|"entertainment",
  "price_trend": "bullish_up"|"bearish_down",
  "target_horizon": "intraday"|"1_to_3_days"|"long_term"|"none",
  "sentiment": "good"|"bad",
  "impact": "high"|"medium"|"low"
}

Rules for 'pass' (Gatekeeper Filter):
- Set "pass" to true ONLY if the headline contains a CLEAR and DEFINITE directional price catalyst (e.g., earnings beat/miss, major contract win/loss, M&A, executive changes, lawsuits, FDA decisions, rate decisions).
- Set "pass" to false if the headline is neutral, priced-in, ambiguous, speculative fluff, clickbait, listicles (e.g. "3 stocks to watch"), or lacks clear market-moving catalyst to push price explicitly up or down.

Rules for 'price_trend' (Directional Bias):
- 'bullish_up': The headline contains a definite POSITIVE catalyst that drives immediate buying pressure and pushes price UP.
- 'bearish_down': The headline contains a definite NEGATIVE catalyst that triggers immediate selling pressure and pushes price DOWN.
(Note: Do NOT predict sideways. If it lacks directional impact, set 'pass' to false).

Rules for 'target_horizon' (Expected Timeframe):
- 'intraday': Immediate price jump or drop expected within the trading session.
- '1_to_3_days': Momentum reaction likely to unfold over 1-3 trading days.
- 'long_term': Structural fundamental shift affecting weeks or months.
- 'none': Set to 'none' if "pass" is false.

Rules for 'impact':
- 'high': Material events (Earnings, M&A, CEO departure, Bankruptcies, Interest rates).
- 'medium': Product releases, operational updates, analyst upgrades/downgrades.
- 'low': Minor PR, routine announcements.

Rules for 'sentiment':
- 'good': Clear positive catalyst driving price UP.
- 'bad': Clear negative catalyst driving price DOWN.

Headline: "${textToAnalyze}"`;

  let response: any;
  let outputText = '';
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in env variables");
    }

    response = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API returned status: ${response.status}`);
    }

    const data = await response.json() as any;
    outputText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
    const firstBrace = outputText.indexOf('{');
    const lastBrace = outputText.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new Error("Could not find valid JSON object in output");
    }
    const cleanJsonStr = outputText.substring(firstBrace, lastBrace + 1);
    const result = JSON.parse(cleanJsonStr);

    let pass = true;
    if (typeof result.pass === 'boolean') {
      pass = result.pass;
    }

    let reason = result.reason || '';
    let category = result.category || 'markets';

    let sentiment: SentimentResult = 'neutral';
    if (result.sentiment === 'good' || result.sentiment === 'bad') {
      sentiment = result.sentiment;
    }

    // Force pass to false if sentiment resolved to neutral (i.e. not good or bad)
    if (sentiment === 'neutral') {
      pass = false;
    }

    let impact: ImpactResult = 'low';
    if (result.impact === 'high' || result.impact === 'medium') {
      impact = result.impact;
    }

    return { pass, reason, category, sentiment, impact };
  } catch (error) {
    console.error("[AI] Gemini API Error:", error);
    if (error instanceof SyntaxError) {
      console.error("[AI] Output text that failed JSON parse:", outputText);
    }
    return {
      pass: false,
      reason: `Failed to analyze via Gemini: ${error instanceof Error ? error.message : String(error)}`,
      category: 'markets',
      sentiment: 'neutral',
      impact: 'low'
    };
  }
}

export async function generateAIOutlook(symbol: string, priceChange: number, headlines: string[]): Promise<string> {
  const headlinesText = headlines.length > 0 ? headlines.slice(0, 5).join('; ') : 'No headlines';
  const prompt = `You are a professional quantitative financial analyst. The stock ${symbol} had an actual price change of ${priceChange.toFixed(2)}% today. The recent news headlines are: "${headlinesText}". Write a concise 2-sentence summary explaining whether the price action matches the news sentiment or if there is a divergence (e.g. Sell on the News, or price dropping despite positive headlines). Be highly specific and objective.`;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in env variables");
    }

    const response = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API returned status: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  } catch (error) {
    console.error(`[AI] Gemini Error generating outlook for ${symbol}:`, error);
    const direction = priceChange > 0 ? 'upward' : priceChange < 0 ? 'downward' : 'neutral';
    return `${symbol} experienced a ${direction} price movement of ${priceChange.toFixed(2)}% today. The news headlines show mixed correlation with this price action, suggesting standard market volatility.`;
  }
}
