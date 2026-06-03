import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const authKey = '68dd6282-8da9-4c07-9f93-e0014091cf05';
        // URL สำหรับดึงข่าวทั้งหมดจาก Finviz แบบ CSV
        const url = `https://elite.finviz.com/news_export?auth=${authKey}`;

        const response = await fetch(url, { next: { revalidate: 300 } }); // Cache 5 นาที
        if (!response.ok) {
            throw new Error(`Finviz API responded with status: ${response.status}`);
        }

        const csvText = await response.text();

        // แปลง CSV เป็น JSON แบบง่ายๆ
        const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        // ข้ามบรรทัดแรก (Header: "Title","Source","Date","Url","Category")
        const dataLines = lines.slice(1);

        const formattedNews = dataLines.map((line, index) => {
            // แยกระหว่างคอมม่า แต่ต้องระวังคอมม่าในเครื่องหมายคำพูด
            // ใช้ Regex อย่างง่ายเพื่อแกะค่าที่อยู่ในเครื่องหมายคำพูด "..."
            const matches = line.match(/(?:\"([^\"]*)\")|([^,]+)/g);
            if (!matches || matches.length < 5) return null;

            // ลบเครื่องหมาย " ออกจากข้อความ
            const clean = (str: string) => str.replace(/^"|"$/g, '').trim();

            const title = clean(matches[0]);
            const source = clean(matches[1]);
            const dateStr = clean(matches[2]);
            const link = clean(matches[3]);
            const category = clean(matches[4]);

            // 1. ตรวจจับคำศัพท์เพื่อหา Sentiment และ Impact
            const lowerTitle = title.toLowerCase();
            const goodWords = ['surge', 'jump', 'record high', 'profit', 'beats', 'rally', 'upgrade', 'buy', 'growth', 'gain', 'soar', 'higher', 'firm', 'advance'];
            const badWords = ['plunge', 'drop', 'lawsuit', 'miss', 'bankruptcy', 'probe', 'downgrade', 'sell', 'loss', 'decline', 'fall', 'lower', 'crash', 'cut', 'slump'];
            const highImpactWords = ['fed', 'rate', 'inflation', 'cpi', 'war', 'attack', 'crash', 'record', 'plunge', 'surge', 'soar', 'buyout', 'acquisition', 'merger'];

            let goodCount = 0;
            let badCount = 0;
            goodWords.forEach(w => { if (lowerTitle.includes(w)) goodCount++; });
            badWords.forEach(w => { if (lowerTitle.includes(w)) badCount++; });

            let calcSentiment = 'neutral';
            if (goodCount > badCount) calcSentiment = 'good';
            else if (badCount > goodCount) calcSentiment = 'bad';

            let isHighImpact = false;
            highImpactWords.forEach(w => {
                // ใช้ regex \b เพื่อให้จับคำเป็นคำๆ ไม่ให้ไปซ้ำกับคำอื่น
                if (new RegExp(`\\b${w}\\b`).test(lowerTitle)) isHighImpact = true;
            });

            let calcImpact = 'low';
            if (isHighImpact || goodCount + badCount >= 2) {
                calcImpact = 'high';
            } else if (goodCount + badCount === 1) {
                calcImpact = 'medium';
            }

            // 2. ตรวจจับชื่อหุ้น (Tickers)
            const tickerMap: Record<string, string> = {
                'apple': 'AAPL', 'iphone': 'AAPL', 'macbook': 'AAPL',
                'tesla': 'TSLA', 'musk': 'TSLA', 'model 3': 'TSLA',
                'microsoft': 'MSFT', 'windows': 'MSFT', 'xbox': 'MSFT',
                'google': 'GOOGL', 'alphabet': 'GOOGL', 'youtube': 'GOOGL',
                'nvidia': 'NVDA', 'gpu': 'NVDA', 'jensen': 'NVDA', 'chip': 'NVDA',
                'meta': 'META', 'facebook': 'META', 'instagram': 'META', 'zuckerberg': 'META',
                'amazon': 'AMZN', 'aws': 'AMZN', 'bezos': 'AMZN',
                'amd': 'AMD',
                'intel': 'INTC',
                'netflix': 'NFLX',
                'disney': 'DIS'
            };

            const foundTickers: { symbol: string; name: string; sentiment: string; sentimentScore: number }[] = [];
            const addedSymbols = new Set<string>();

            Object.entries(tickerMap).forEach(([keyword, symbol]) => {
                if (new RegExp(`\\b${keyword}\\b`).test(lowerTitle) && !addedSymbols.has(symbol)) {
                    addedSymbols.add(symbol);
                    foundTickers.push({
                        symbol: symbol,
                        name: symbol,
                        sentiment: calcSentiment === 'good' ? 'up' : calcSentiment === 'bad' ? 'down' : 'flat',
                        sentimentScore: calcSentiment === 'good' ? 5 : calcSentiment === 'bad' ? -5 : 0
                    });
                }
            });

            return {
                id: `finviz-${index}-${Date.now()}`,
                headline: title,
                body: `Source: ${source} - ${category}`,
                sources: [{ name: source, url: link }],
                publishedAt: `${dateStr.replace(' ', 'T')}-04:00`,
                regionTag: 'global',
                countryCode: 'us',
                category: category.toLowerCase() === 'market' ? 'markets' : 'economy',
                impact: calcImpact,
                sentiment: calcSentiment,
                tickers: foundTickers, // สกัด Ticker จากพาดหัวข่าว
                imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 15).replace(/\s+/g, ''))}/800/450`
            };
        }).filter(item => item !== null);

        return NextResponse.json({
            success: true,
            count: formattedNews.length,
            news: formattedNews
        });
    } catch (error) {
        console.error("Error fetching Finviz news:", error);
        return NextResponse.json({ success: false, error: 'Failed to fetch news' }, { status: 500 });
    }
}
