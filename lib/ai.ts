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
    // @ts-ignore
    return { label: response.labels[0], score: response.scores[0] };
  } catch (error) {
    console.error("[AI] Error categorizing via Hugging Face API:", error);
    return { label: 'markets', score: 1 };
  }
}

