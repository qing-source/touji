// stock_backtest.js — A股个股回测（v2.0 规则：P1/P2 趋势 + P4 极值风控）
// 规则：收盘突破前20日最高收盘 且 收盘>MA20 且 量>5日均量×1.5 → 次日开盘买入
//       收盘跌破MA20连续两日 或 跌破-5%止损 → 次日开盘卖出
//       P4: 收盘>MA200×1.25 时离场线收紧至MA10
const fs = require('fs');

const STOCKS = ['600519', '000858', '000001', '600036', '300750', '601318', '600030', '002594'];
const NAMES = { '600519': '贵州茅台', '000858': '五粮液', '000001': '平安银行', '600036': '招商银行', '300750': '宁德时代', '601318': '中国平安', '600030': '中信证券', '002594': '比亚迪' };

function load(code) {
  return fs.readFileSync(`data_${code}.csv`, 'utf8').trim().split('\n').slice(1).map(l => {
    const p = l.split(',');
    return { date: p[0], open: +p[1], high: +p[2], low: +p[3], close: +p[4], vol: +p[5] };
  });
}
const sma = (a, n) => { const o = Array(a.length).fill(null); let s = 0;
  for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; } return o; };
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

function run(rows, useP4 = true, costBps = 1) {
  const close = rows.map(r => r.close), open = rows.map(r => r.open), vol = rows.map(r => r.vol), n = rows.length;
  const ma10 = sma(close, 10), ma20 = sma(close, 20), ma200 = sma(close, 200), v5 = sma(vol, 5);
  const hh20 = Array(n).fill(null);
  for (let i = 20; i < n; i++) { let h = -1e9; for (let j = i - 20; j < i; j++) h = Math.max(h, close[j]); hh20[i] = h; }
  const cost = costBps / 10000;
  let cash = 1, pos = 0, entry = 0, entryIdx = -1, stop = -1e9, cool = false;
  const eq = Array(n).fill(1), trades = [];
  for (let i = 200; i < n - 1; i++) {
    const p4 = useP4 && ma200[i] && close[i] > ma200[i] * 1.25;
    if (p4) cool = true;
    if (ma200[i] && close[i] < ma200[i] * 1.15) cool = false;
    const xl = p4 ? ma10[i] : ma20[i];
    const no = open[i + 1];
    if (pos > 0) {
      let ex = false, rs = '';
      if (close[i] < stop) { ex = true; rs = '止损-5%'; }
      else if (xl && close[i] < xl && close[i - 1] < xl) { ex = true; rs = p4 ? '跌破10日线(P4)' : '跌破20日线两日'; }
      if (ex) { cash += pos * no * (1 - cost); trades.push({ ret: no / entry - 1 - 2 * cost, hold: i + 1 - entryIdx, rs, in: rows[entryIdx].date, out: rows[i + 1].date }); pos = 0; }
    }
    if (pos === 0) {
      const breakout = hh20[i] && close[i] > hh20[i] && ma20[i] && close[i] > ma20[i] && v5[i] && vol[i] > v5[i] * 1.5 && !cool;
      if (breakout) { entry = no; entryIdx = i + 1; const amt = cash; pos = amt * (1 - cost) / entry; cash -= amt; stop = entry * 0.95; }
    }
    eq[i + 1] = cash + pos * close[i + 1];
  }
  let peak = -1, dd = 0;
  for (let i = 200; i < n; i++) { peak = Math.max(peak, eq[i]); dd = Math.min(dd, eq[i] / peak - 1); }
  const wins = trades.filter(t => t.ret > 0);
  const years = (n - 200) / 252;
  const bh = close[n - 1] / close[200] - 1;
  const rets = []; for (let i = 201; i < n; i++) rets.push(eq[i] / eq[i - 1] - 1);
  const m = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / rets.length);
  return {
    code: '', name: '', trades: trades.length, wr: trades.length ? wins.length / trades.length : 0,
    total: eq[n - 1] - 1, bh, cagr: Math.pow(eq[n - 1], 1 / years) - 1, mdd: dd,
    sharpe: sd ? m / sd * Math.sqrt(252) : 0,
    avgHold: trades.length ? avg(trades.map(t => t.hold)) : 0,
    lastTrade: trades[trades.length - 1] || null
  };
}

const rowsAll = {};
for (const c of STOCKS) rowsAll[c] = load(c);

// 单票结果
console.log('===== A股个股回测（2020-06 → 2026-08，约6年，1‰单边成本，次日开盘成交）=====');
console.log('代码    名称      总收益    年化    最大回撤  夏普   胜率    笔数  均持仓   vs买入持有');
const agg = { total: [], bh: [], mdd: [], wr: [] };
for (const c of STOCKS) {
  const r = run(rowsAll[c]); r.code = c; r.name = NAMES[c];
  agg.total.push(r.total); agg.bh.push(r.bh); agg.mdd.push(r.mdd); agg.wr.push(r.wr);
  console.log(`${c}  ${r.name.padEnd(5)} ${(r.total * 100).toFixed(1).padStart(6)}%  ${(r.cagr * 100).toFixed(1).padStart(5)}%  ${(r.mdd * 100).toFixed(1).padStart(6)}%  ${r.sharpe.toFixed(2).padStart(5)}  ${(r.wr * 100).toFixed(0).padStart(3)}%  ${String(r.trades).padStart(3)}  ${r.avgHold.toFixed(0).padStart(3)}日  ${(r.bh * 100).toFixed(1).padStart(6)}%`);
}
const avgN = x => avg(x) * 100;
console.log(`\n===== 汇总（8只等权）=====`);
console.log(`策略平均总收益: ${avgN(agg.total).toFixed(1)}%   | 买入持有平均: ${avgN(agg.bh).toFixed(1)}%`);
console.log(`策略平均最大回撤: ${avgN(agg.mdd).toFixed(1)}%  | 平均胜率: ${avgN(agg.wr).toFixed(1)}%`);
console.log(`策略跑赢持有的标的数: ${agg.total.filter((t, i) => t > agg.bh[i]).length}/8`);

// 组合回测（等权轮动：每只票独立资金，资金分成8份）
console.log(`\n===== 组合视角（8只等权独立资金）=====`);
let comb = 1;
for (const c of STOCKS) comb *= (1 + run(rowsAll[c]).total);
const combRet = Math.pow(comb, 1 / 8) - 1;
console.log(`8只等权组合累计收益: ${(combRet * 100).toFixed(1)}%  | 组合买入持有: ${(Math.pow(agg.bh.reduce((a, b) => a * (1 + b), 1), 1 / 8) - 1) * 100}%`);
