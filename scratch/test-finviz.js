const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

async function test() {
  const response = await fetch('https://finviz.com/news.ashx', { headers: HEADERS });
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('styled-table-new tr print:');

  $('table.styled-table-new tr').slice(0, 50).each((i, row) => {
    const time = $(row).find('td.news_date-cell').text().trim();
    const linkEl = $(row).find('a.nn-tab-link');
    const title = linkEl.text().trim();
    if (title) {
      console.log(`${i + 1}. [${time}] "${title}"`);
    }
  });
}

test();
