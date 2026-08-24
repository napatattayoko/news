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
      try {
        const cloned = response.clone();
        const errJson = await cloned.json();
        const errMsg = errJson?.error?.message || '';
        if (errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('limit')) {
          console.error(`[AI] Daily/Monthly Gemini API quota limit reached. Skipping retries.`);
          return response;
        }
      } catch (e) {
        // Ignore JSON clone/parse errors
      }

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

const MODEL_FALLBACKS = [
  process.env.GEMINI_MODEL,
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
].filter(Boolean) as string[];

async function fetchGeminiWithFallback(body: any): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in env variables");
  }

  let lastResponse: Response | null = null;
  let lastError: any = null;

  for (const model of MODEL_FALLBACKS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      console.log(`[AI] Attempting call with model: ${model}`);
      const res = await fetchGeminiWithRetry(url, body);
      if (res.ok) {
        return res;
      }
      lastResponse = res;
      console.warn(`[AI] Model ${model} failed with status ${res.status}. Trying next...`);
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI] Error calling model ${model}:`, err.message);
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error("All fallback models failed");
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
  "sentiment": "good"|"bad"|"neutral",
  "impact": "high"|"medium"|"low"
}

Rules for 'pass' (Gatekeeper Filter):
1. KEEP (Set "pass" to true): The headline MUST report actual occurred events, quantitative numbers, regulatory actions, earnings results, official contracts signed, executive changes, or lawsuits.
2. REJECT (Set "pass" to false): Reject headlines that are purely speculative, future predictions without hard data, general commentary, executive fluff quotes ("plans to", "expects to", "thinks that", "might", "could"), indirect partner mentions, listicles ("3 stocks to watch"), or clickbait.

Rules for 'category':
- Set category to "FACT" if "pass" is true.
- Set category to "SPECULATION" or "NOISE" if "pass" is false, depending on the nature of the headline.

Rules for 'sentiment':
- 'good': Clear positive catalyst driving price UP.
- 'bad': Clear negative catalyst driving price DOWN.
- 'neutral': Use for ANY speculation, predictions, rumors, or if "pass" is false.

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
    response = await fetchGeminiWithFallback({
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
    });

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
  const prompt = `You are a professional quantitative financial analyst. 
The stock ${symbol} had an actual price change of ${priceChange.toFixed(2)}% today. 
The recent news headlines are: "${headlinesText}". 

Write a highly concise, professional 2-sentence summary explaining whether the price action matches the recent news sentiment or if there is a divergence (e.g., Sell on the News, or price dropping despite positive headlines). 

Use markdown bold formatting (e.g., **divergence**, **bullish**, **sell-the-news**, **0.11% gain**) on critical metrics and key insights to make the text extremely easy to read, scan, and understand at a glance. Be highly specific and objective.`;


  try {
    const response = await fetchGeminiWithFallback({
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
    });

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
