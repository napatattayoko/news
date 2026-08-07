import { HfInference } from '@huggingface/inference';

// Initialize the Hugging Face Inference client
// Ensure HUGGINGFACE_API_KEY is in your .env or .env.local file
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

const SENTIMENT_MODEL = 'ProsusAI/finbert';
const CATEGORY_MODEL = 'facebook/bart-large-mnli';

export type SentimentResult = 'good' | 'neutral' | 'bad';
export type ImpactResult = 'high' | 'medium' | 'low';

export interface AIAnalysisResult {
  sentiment: SentimentResult;
  impact: ImpactResult;
}

export async function analyzeArticle(headline: string, body: string): Promise<AIAnalysisResult> {
  const textToAnalyze = headline.substring(0, 500);

  const prompt = `You are a strict quantitative financial analyst. Analyze this headline and output a JSON object EXACTLY matching this schema: {"sentiment": "good"|"neutral"|"bad", "impact": "high"|"medium"|"low"}

Rules for Impact:
- 'high': Only for MATERIAL events (Earnings, M&A, Bankruptcies, CEO changes, FDA approvals, Lawsuits).
- 'medium': Product launches, operational updates, analyst upgrades/downgrades.
- 'low': Fluff, opinions, market commentary, "top stocks to buy", generic PR.

Rules for Sentiment:
- If it's fluff or purely generic market recap, default to 'neutral'.
- Otherwise, 'good' for positive news, 'bad' for negative.

Output ONLY valid JSON. No explanations, no markdown block.

Headline: "${textToAnalyze}"`;

  try {
    const response = await hf.chatCompletion({
      model: 'meta-llama/Meta-Llama-3-8B-Instruct',
      messages: [
        { role: 'system', content: 'You are a JSON-only financial analyzer. Output only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 50,
      temperature: 0.1,
    });

    const outputText = response.choices[0]?.message?.content?.trim() || '{}';
    
    // Clean up potential markdown formatting if the model disobeys
    const jsonStr = outputText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);

    let sentiment: SentimentResult = 'neutral';
    if (result.sentiment === 'good' || result.sentiment === 'bad') {
      sentiment = result.sentiment;
    }

    let impact: ImpactResult = 'low';
    if (result.impact === 'high' || result.impact === 'medium') {
      impact = result.impact;
    }

    // Double check: if it's neutral, impact shouldn't matter but we can force it low
    if (sentiment === 'neutral') impact = 'low';

    return { sentiment, impact };
  } catch (error) {
    console.error("[AI] LLaMA-3 API Error, falling back to FinBERT:", error);
    
    // FALLBACK: Use FinBERT if LLaMA-3 is overloaded or rate limited
    try {
      const response = await hf.textClassification({
        model: SENTIMENT_MODEL, // ProsusAI/finbert
        inputs: textToAnalyze,
      });

      const topResult = response[0];
      const topLabel = topResult.label.toLowerCase();
      const topScore = topResult.score;

      let sentiment: SentimentResult = 'neutral';
      if (topLabel === 'positive') sentiment = 'good';
      else if (topLabel === 'negative') sentiment = 'bad';

      let impact: ImpactResult = 'low';
      
      if (sentiment !== 'neutral') {
        if (topScore >= 0.8) {
          impact = 'high';
        } else if (topScore >= 0.5) {
          impact = 'medium';
        }
      }

      return { sentiment, impact };
    } catch (fallbackError) {
      console.error("[AI] FinBERT Fallback also failed:", fallbackError);
      return { sentiment: 'neutral', impact: 'low' };
    }
  }
}

export async function categorizeArticle(text: string, candidateLabels: string[]): Promise<{ label: string, score: number }> {
  try {
    const response = await hf.zeroShotClassification({
      model: CATEGORY_MODEL,
      inputs: text,
      parameters: { candidate_labels: candidateLabels }
    });
    // The response is an array of objects: [{label: '...', score: 0.9}, ...]
    const topResult = response[0] as any;
    return { label: topResult.label, score: topResult.score };
  } catch (error) {
    console.error("[AI] Error categorizing via Hugging Face API:", error);
    return { label: 'markets', score: 1 };
  }
}

export async function generateAIOutlook(symbol: string, priceChange: number, headlines: string[]): Promise<string> {
  const headlinesText = headlines.length > 0 ? headlines.slice(0, 5).join('; ') : 'No headlines';
  const prompt = `You are a professional quantitative financial analyst. The stock ${symbol} had an actual price change of ${priceChange.toFixed(2)}% today. The recent news headlines are: "${headlinesText}". Write a concise 2-sentence summary explaining whether the price action matches the news sentiment or if there is a divergence (e.g. Sell on the News, or price dropping despite positive headlines). Be highly specific and objective.`;

  try {
    const response = await hf.chatCompletion({
      model: 'meta-llama/Meta-Llama-3-8B-Instruct',
      messages: [
        { role: 'system', content: 'You are a professional quantitative financial analyst.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error(`[AI] Error generating outlook for ${symbol}:`, error);
    // Fallback based on simple logic if HF fails or API key is missing
    const direction = priceChange > 0 ? 'upward' : priceChange < 0 ? 'downward' : 'neutral';
    return `${symbol} experienced a ${direction} price movement of ${priceChange.toFixed(2)}% today. The news headlines show mixed correlation with this price action, suggesting standard market volatility.`;
  }
}

