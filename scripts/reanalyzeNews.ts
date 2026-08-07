import { PrismaClient } from '@prisma/client';
import { analyzeArticle } from '../lib/ai';

const prisma = new PrismaClient();

// Utility function to sleep and avoid API rate limits
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const args = process.argv.slice(2);
  const targetTicker = args[0] ? args[0].toUpperCase() : null;

  console.log("🚀 Starting Safe Re-analysis of Old News...");
  if (targetTicker) {
    console.log(`🎯 Targeting specifically for ticker: ${targetTicker}`);
  }

  // 1. Fetch news from the last 15 days
  const daysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  
  let newsToUpdate = await prisma.news.findMany({
    where: {
      publishedAt: { gte: daysAgo }
    },
    select: { id: true, headline: true, body: true, sentiment: true, impact: true, tickers: true },
    orderBy: { publishedAt: 'desc' }
  });

  // Filter in memory if a specific ticker is requested
  if (targetTicker) {
    newsToUpdate = newsToUpdate.filter(item => {
      try {
        const parsed = JSON.parse(item.tickers as string) || [];
        const tickersList = parsed.map((t: any) => {
          if (typeof t === "string") return t.toUpperCase();
          if (t && t.symbol) return t.symbol.toUpperCase();
          if (t && t.Symbol) return t.Symbol.toUpperCase();
          return "";
        });
        return tickersList.includes(targetTicker);
      } catch (err) {
        return false;
      }
    });
  }

  console.log(`Found ${newsToUpdate.length} articles from the last 15 days${targetTicker ? ` for ${targetTicker}` : ''}.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < newsToUpdate.length; i++) {
    const item = newsToUpdate[i];
    console.log(`[${i + 1}/${newsToUpdate.length}] Analyzing: "${item.headline.substring(0, 50)}..."`);

    try {
      // 2. Pass to LLaMA-3
      const newAnalysis = await analyzeArticle(item.headline, item.body || "");

      // 3. Update ONLY sentiment and impact safely
      await prisma.news.update({
        where: { id: item.id },
        data: {
          sentiment: newAnalysis.sentiment,
          impact: newAnalysis.impact
        }
      });

      console.log(`   -> Old: [${item.sentiment}, ${item.impact}] | New: [${newAnalysis.sentiment}, ${newAnalysis.impact}]`);
      successCount++;
    } catch (error) {
      console.error(`   -> ❌ Failed to analyze (API Error). Skipping.`);
      failCount++;
    }

    // 4. Wait 2 seconds before the next one to protect HuggingFace API from banning us
    await sleep(2000);
  }

  console.log(`\n✅ Done! Successfully updated: ${successCount} | Failed: ${failCount}`);
}

main()
  .catch(e => {
    console.error("Fatal Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
