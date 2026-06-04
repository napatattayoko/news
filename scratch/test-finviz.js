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
  
  let countOld = 0;
  $('table.styled-table-new tr').each(() => countOld++);
  
  let countA = 0;
  $('a.nn-tab-link').each(() => countA++);

  console.log('styled-table-new tr count:', countOld);
  console.log('a.nn-tab-link count:', countA);
}

test();
