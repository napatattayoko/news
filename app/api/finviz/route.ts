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

            // สุ่ม Impact/Sentiment เพราะ Finviz ไม่ได้ให้มา
            const impacts = ['high', 'medium', 'low'];
            const sentiments = ['good', 'bad', 'neutral'];
            const randomImpact = impacts[Math.floor(Math.random() * impacts.length)];
            const randomSentiment = sentiments[Math.floor(Math.random() * sentiments.length)];

            return {
                id: `finviz-${index}-${Date.now()}`,
                headline: title,
                body: `Source: ${source} - ${category}`, // ไม่มี body ใน Finviz ข่าว
                sources: [{ name: source, url: link }],
                publishedAt: dateStr, // e.g. "2026-05-29 04:04:48"
                regionTag: 'global',
                countryCode: 'us',
                category: category.toLowerCase() === 'market' ? 'markets' : 'economy',
                impact: randomImpact,
                sentiment: randomSentiment,
                tickers: [], // Finviz news API แบบธรรมดาไม่แนบ Ticker ถ้าไม่ได้ Filter หุ้นเฉพาะเจาะจง
                // สร้างรูปภาพจำลองแบบสุ่มแต่คงที่ด้วย Picsum โดยใช้ title เป็น seed
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
