// resonance.js — 板块共振代理检查（最近交易日涨幅>5%家数）
const fs = require('fs');
const src = fs.readFileSync('data.js', 'utf8');
const DATASET = JSON.parse(src.slice('const DATASET='.length).replace(/;\s*$/, ''));
const series = k => { const s = DATASET.series[k]; if (!s) return null; return s.csv.trim().split('\n').slice(1).map(l => { const p = l.split(','); return { date: p[0], open: +p[1], high: +p[2], low: +p[3], close: +p[4], vol: +p[5] || 0 }; }); };
const r1 = k => { const s = series(k); if (!s) return null; const i = s.length - 1; return s[i].close / s[i - 1].close - 1; };
for (const [sec, codes] of Object.entries(DATASET.sectors)) {
  const rows = codes.map(c => ({ name: DATASET.names[c] || c, code: c, ret: r1(c) })).filter(x => x.ret != null).sort((a, b) => b.ret - a.ret);
  const up5 = rows.filter(x => x.ret > 0.05).length;
  const d = series(rows[0].code).slice(-1)[0].date;
  console.log(sec.padEnd(5), '最后交易日', d, '| 涨幅>5%家数:', up5 + '/' + rows.length, '| 领涨:', rows.slice(0, 3).map(x => x.name + ' ' + (x.ret * 100).toFixed(1) + '%').join(', '));
}
