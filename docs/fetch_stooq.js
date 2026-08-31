// fetch_stooq.js — 下载真实日线数据（Stooq 免费公开数据，含浏览器校验的工作量证明解题）
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const targets = [
  ['spx', '^spx'],   // 标普500
  ['hsi', '^hsi'],   // 恒生指数
  ['shc', '^shc'],   // 上证综指
];

const cookieJar = [];
async function solveChallenge(html, cookie) {
  const m = html.match(/const c="([^"]+)"/);
  if (!m) throw new Error('challenge not found');
  const c = m[1];
  const d = parseInt((html.match(/d=(\d+)/) || [])[1] || '4');
  const prefix = '0'.repeat(d);
  const enc = new TextEncoder();
  let n = 0;
  while (true) {
    const h = crypto.createHash('sha256').update(c + n).digest('hex');
    if (h.startsWith(prefix)) break;
    n++;
    if (n > 5e6) throw new Error('pow failed');
  }
  const r = await fetch('https://stooq.com/__verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0' },
    body: 'c=' + encodeURIComponent(c) + '&n=' + n,
  });
  const sc = r.headers.get('set-cookie');
  if (sc) cookieJar.push(sc.split(';')[0]); // 回传给调用方
  return r.status;
}

(async () => {
  const outDir = __dirname;
  let cookie = '';
  for (const [name, sym] of targets) {
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d`;
    for (let attempt = 0; attempt < 4; attempt++) {
      const r = await fetch(url, { headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0' } });
      const sc = r.headers.get('set-cookie');
      if (sc) cookie = sc.split(';')[0];
      const text = await r.text();
      if (text.startsWith('Date,')) {
        const lines = text.trim().split('\n');
        const first = lines[1], last = lines[lines.length - 1];
        fs.writeFileSync(path.join(outDir, `data_${name}.csv`), text);
        console.log(`${name}: OK ${lines.length - 1} rows | first=${first} | last=${last}`);
        break;
      } else if (text.includes('__verify') || text.includes('verify your browser')) {
        await solveChallenge(text, cookie);
        cookie = [...cookieJar].join('; ');
        await new Promise(res => setTimeout(res, 3000)); // 防限流
      } else {
        console.log(`${name}: attempt ${attempt} unexpected: ${text.slice(0, 80)}`);
      }
    }
  }
})();
