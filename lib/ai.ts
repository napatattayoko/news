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
  // Analyze only the headline. Financial headlines contain the core sentiment,
  // and the body from Finviz ("Published at... Sourced from...") can dilute it.
  const textToAnalyze = headline.substring(0, 500);

  try {
    const response = await hf.textClassification({
      model: SENTIMENT_MODEL,
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
  } catch (error) {
    console.error("[AI] Error analyzing sentiment via Hugging Face API:", error);
    return { sentiment: 'neutral', impact: 'low' };
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

