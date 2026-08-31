// fetch_all.js — 统一下载三大指数真实日线数据（可重复执行，数据源公开免费）
// 来源：
//   上证综指  sh000001  新浪财经公开K线接口（约1500根，≈6年）
//   恒生指数  hkHSI     腾讯证券公开K线接口（2000根，≈8年）
//   标普500   us.INX    腾讯证券公开K线接口（2000根，≈8年）
// 输出统一 CSV：Date,Open,High,Low,Close,Volume
const fs = require('fs');
const path = require('path');
const UA = 'Mozilla/5.0';

async function fetchSSE() {
  const url = 'https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=sh000001&scale=240&ma=no&datalen=1500';
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://finance.sina.com.cn' } });
  const j = JSON.parse(await r.text());
  if (!j || !j.length) throw new Error('sina empty');
  return j.map(k => [k.day, +k.open, +k.high, +k.low, +k.close, +k.volume]);
}

async function fetchTencent(sym) {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${sym},day,,,2000,qfq`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://gu.qq.com' } });
  const j = await r.json();
  const k = (j.data[sym].day || j.data[sym].qfqday);
  if (!k || !k.length) throw new Error('tencent empty');
  return k.map(x => [x[0], +x[1], +x[3], +x[4], +x[2], +x[5]]); // 腾讯列序: date,open,close,high,low,volume
}

(async () => {
  const jobs = [
    ['shc', fetchSSE, '新浪财经 CN_MarketDataService (sh000001)'],
    ['hsi', () => fetchTencent('hkHSI'), '腾讯证券 ifzq.gtimg.cn (hkHSI)'],
    ['spx', () => fetchTencent('us.INX'), '腾讯证券 ifzq.gtimg.cn (us.INX)'],
  ];
  const meta = {};
  for (const [name, fn, src] of jobs) {
    let rows = null;
    for (let i = 0; i < 3 && !rows; i++) {
      try { rows = await fn(); }
      catch (e) { console.log(`${name} retry ${i}: ${e.message}`); await new Promise(r => setTimeout(r, 5000)); }
    }
    if (!rows) { console.log(`${name}: FAILED`); continue; }
    rows.sort((a, b) => a[0] < b[0] ? -1 : 1);
    const csv = 'Date,Open,High,Low,Close,Volume\n' + rows.map(r => r.join(',')).join('\n');
    fs.writeFileSync(path.join(__dirname, `data_${name}.csv`), csv);
    meta[name] = { source: src, rows: rows.length, first: rows[0][0], last: rows[rows.length - 1][0] };
    console.log(`${name}: OK ${rows.length} rows ${meta[name].first} → ${meta[name].last}`);
  }
  fs.writeFileSync(path.join(__dirname, 'data_meta.json'), JSON.stringify(meta, null, 2));
})();
