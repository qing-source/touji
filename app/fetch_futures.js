// fetch_futures.js — 修复版：新浪期货日K（JSONP 格式 var t=([{...}])）
const fs = require('fs');
const path = require('path');
const UA = 'Mozilla/5.0';

const FUTURES = { 'IF0': '沪深300股指期货(主力)', 'IC0': '中证500股指期货(主力)', 'IM0': '中证1000股指期货(主力)', 'AU0': '沪金期货(主力)', 'RB0': '螺纹钢期货(主力)', 'CU0': '沪铜期货(主力)' };

async function sinaFuture(sym) {
  const url = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20t=/InnerFuturesNewService.getDailyKLine?symbol=${sym}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://finance.sina.com.cn' } });
  const t = await r.text();
  const m = t.match(/var\s*t\s*=\s*\((\[[\s\S]*?\])\)/);
  if (!m) throw new Error('parse fail: ' + t.slice(0, 80));
  const arr = JSON.parse(m[1]);
  if (!arr || !arr.length) throw new Error('empty');
  return arr.map(k => [k.d, +k.o, +k.h, +k.l, +k.c, +(k.v || 0)]);
}

(async () => {
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'data_sectors_meta.json'), 'utf8'));
  for (const [sym, name] of Object.entries(FUTURES)) {
    let rows = null;
    for (let i = 0; i < 4 && !rows; i++) {
      try { rows = await sinaFuture(sym); }
      catch (e) { console.log(`${sym} retry${i}: ${e.message}`); await new Promise(r => setTimeout(r, 4000)); }
    }
    if (!rows) { console.log(`${sym} FAILED`); continue; }
    rows.sort((a, b) => a[0] < b[0] ? -1 : 1);
    const csv = 'Date,Open,High,Low,Close,Volume\n' + rows.map(r => r.join(',')).join('\n');
    fs.writeFileSync(path.join(__dirname, `data_${sym}.csv`), csv);
    meta[sym] = { source: `新浪财经期货日K (${name})`, rows: rows.length, first: rows[0][0], last: rows[rows.length - 1][0] };
    console.log(`${sym}: ${rows.length} (${meta[sym].first} → ${meta[sym].last})`);
    await new Promise(r => setTimeout(r, 1500));
  }
  fs.writeFileSync(path.join(__dirname, 'data_sectors_meta.json'), JSON.stringify(meta, null, 2));
  console.log('futures done');
})();
