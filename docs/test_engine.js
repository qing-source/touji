// test_engine.js — 回测引擎 v2 无头验证（与 backtest.html 同构：收盘信号→次日开盘成交）
const fs = require('fs');
function load(name) {
  return fs.readFileSync(`data_${name}.csv`, 'utf8').trim().split('\n').slice(1).map(l => {
    const p = l.split(',');
    return { date: p[0], open: +p[1], high: +p[2], low: +p[3], close: +p[4], vol: +p[5] };
  });
}
const sma = (a, n) => { const o = Array(a.length).fill(null); let s = 0;
  for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; } return o; };

function run(rows, strat, useP4) {
  const close = rows.map(r => r.close), open = rows.map(r => r.open), vol = rows.map(r => r.vol || 0), n = rows.length;
  const ma10 = sma(close, 10), ma20 = sma(close, 20), ma200 = sma(close, 200), v5 = sma(vol, 5);
  const hh20 = Array(n).fill(null);
  for (let i = 20; i < n; i++) { let h = -1e9; for (let j = i - 20; j < i; j++) h = Math.max(h, close[j]); hh20[i] = h; }
  const cost = 0.0001;
  let cash = 1, pos = 0, entry = 0, entryIdx = -1, stop = -1e9, cool = false;
  const eq = Array(n).fill(1), trades = [];
  for (let i = 200; i < n - 1; i++) {
    const p4 = useP4 && ma200[i] && close[i] > ma200[i] * 1.25;
    if (p4) cool = true;
    if (ma200[i] && close[i] < ma200[i] * 1.15) cool = false;
    const xl = p4 ? ma10[i] : ma20[i];
    const nextOpen = open[i + 1];
    if (pos > 0) {
      let ex = false, rs = '';
      if (strat === 'panic') {
        const rt = close[i] / entry - 1;
        if (rt <= -0.04) { ex = 1; rs = 'stop'; }
        else if (rt >= 0.08) { ex = 1; rs = 'target'; }
        else if (ma10[i] && close[i] > ma10[i] && rt > 0) { ex = 1; rs = 'ma'; }
        else if (i - entryIdx >= 10) { ex = 1; rs = 'time'; }
      } else {
        if (close[i] < stop) { ex = 1; rs = 'stop'; }
        else if (xl && close[i] < xl && close[i - 1] < xl) { ex = 1; rs = p4 ? 'below10' : 'below20'; }
      }
      if (ex) { cash += pos * nextOpen * (1 - cost); trades.push({ ret: nextOpen / entry - 1 - 2 * cost, rs }); pos = 0; }
    }
    if (pos === 0) {
      const sd = rows[i - 1], td = rows[i];
      const panic = sd.close / sd.open - 1 <= -0.03 && td.close > td.open && td.low >= sd.low * 0.995;
      const trend = hh20[i] && close[i] > hh20[i] && ma20[i] && close[i] > ma20[i] && v5[i] && vol[i] > v5[i] * 1.5 && close[i - 1] <= hh20[i] && !cool;
      let w = 0;
      if (strat !== 'panic' && trend) w = 1;
      if (strat !== 'trend' && panic) w = Math.max(w, 0.25);
      if (w > 0) { const amt = cash * w; entry = nextOpen; entryIdx = i + 1;
        pos = amt * (1 - cost) / entry; cash -= amt; stop = entry * 0.95; }
    }
    eq[i + 1] = cash + pos * close[i + 1];
  }
  let peak = -1, dd = 0;
  for (let i = 200; i < n; i++) { peak = Math.max(peak, eq[i]); dd = Math.min(dd, eq[i] / peak - 1); }
  const wins = trades.filter(t => t.ret > 0).length;
  return { trades: trades.length, wr: trades.length ? 100 * wins / trades.length : 0,
    total: 100 * (eq[n - 1] - 1), bh: 100 * (close[n - 1] / close[200] - 1), mdd: 100 * dd };
}

for (const mkt of ['shc', 'hsi', 'spx']) {
  const rows = load(mkt);
  for (const strat of ['trend', 'panic', 'combo']) {
    const r = run(rows, strat, true);
    console.log(`${mkt} ${strat.padEnd(6)} trades=${String(r.trades).padStart(3)} wr=${r.wr.toFixed(0).padStart(3)}% total=${r.total.toFixed(1).padStart(7)}% (bh=${r.bh.toFixed(1)}%) mdd=${r.mdd.toFixed(1)}%`);
  }
  console.log(`${mkt} bh     total=${run(rows, 'trend', false).bh.toFixed(1)}%`);
}
