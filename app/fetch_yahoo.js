// fetch_yahoo.js — Yahoo Finance chart API（cookie+crumb 官方流程）下载真实日线数据
const fs = require('fs');
const path = require('path');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const targets = [
  ['spx', '%5EGSPC'],   // 标普500
  ['hsi', '%5EHSI'],    // 恒生指数
  ['shc', '000001.SS'], // 上证综指
];

async function getCookieCrumb() {
  for (let i = 0; i < 5; i++) {
    const r1 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' }).catch(() => null);
    let cookie = (r1 && r1.headers.get('set-cookie') || '').split(';')[0];
    if (!cookie) cookie = 'A1=d=q';
    const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, Cookie: cookie },
    });
    if (r2.status === 200) {
      const crumb = (await r2.text()).trim();
      if (crumb && !crumb.includes('<')) return { cookie, crumb };
    }
    console.log(`crumb attempt ${i} failed (${r2.status}), waiting...`);
    await new Promise(res => setTimeout(res, 8000));
  }
  throw new Error('cannot get crumb');
}

(async () => {
  const { cookie, crumb } = await getCookieCrumb();
  for (const [name, sym] of targets) {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?period1=1199145600&period2=${Math.floor(Date.now() / 1000)}&interval=1d&events=div,split&crumb=${encodeURIComponent(crumb)}`;
    try {
      let j;
      const r = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cookie } });
      if (r.status !== 200) {
        console.log(`${name}: HTTP ${r.status}, retry after 15s`);
        await new Promise(res => setTimeout(res, 15000));
        const r2b = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cookie } });
        if (r2b.status !== 200) { console.log(`${name}: still ${r2b.status}`); continue; }
        j = await r2b.json();
      } else j = await r.json();
      const res = j.chart.result[0];
      const ts = res.timestamp, q = res.indicators.quote[0];
      const rows = ['Date,Open,High,Low,Close,Volume'];
      for (let i = 0; i < ts.length; i++) {
        if (q.close[i] == null) continue;
        const d = new Date(ts[i] * 1000).toISOString().slice(0, 10);
        rows.push([d, q.open[i], q.high[i], q.low[i], q.close[i], q.volume[i] || 0].join(','));
      }
      fs.writeFileSync(path.join(__dirname, `data_${name}.csv`), rows.join('\n'));
      console.log(`${name}: OK ${rows.length - 1} rows | ${rows[1][0]}${rows[1].slice(1, 12)}... → ${rows[rows.length - 1].slice(0, 18)}`);
    } catch (e) { console.log(`${name}: ERR ${e.message}`); }
    await new Promise(res => setTimeout(res, 6000));
  }
})();
