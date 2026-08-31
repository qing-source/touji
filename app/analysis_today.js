// analysis_today.js — 今日盘面综合投机分析（大盘状态 → 板块热度 → 系统符合 → 个股买卖点）
const fs = require('fs');
const src = fs.readFileSync('data.js', 'utf8');
const DATASET = JSON.parse(src.slice('const DATASET='.length).replace(/;\s*$/, ''));

const cache = {};
function series(k) {
  if (cache[k]) return cache[k];
  const s = DATASET.series[k]; if (!s) return null;
  cache[k] = s.csv.trim().split('\n').slice(1).map(l => { const p = l.split(','); return { date: p[0], open: +p[1], high: +p[2], low: +p[3], close: +p[4], vol: +p[5] || 0 }; });
  return cache[k];
}
const sma = (a, n) => { const o = Array(a.length).fill(null); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; } return o; };
const last = (r, n) => r && r.length > n + 1 ? r[r.length - 1].close / r[r.length - 1 - n].close - 1 : null;
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const SECTORS = DATASET.sectors, NAMES = DATASET.names;

console.log('══════════════════════════════════════════════════════════');
console.log('  今日盘面投机分析 · 最近交易日 ' + DATASET.series['shc'].last + '（周末无新盘）');
console.log('══════════════════════════════════════════════════════════\n');

/* ① 大盘状态判定（v2.0 状态机） */
const idx = series('shc');
const c = idx.map(x => x.close), v = idx.map(x => x.vol), i = c.length - 1;
const ma20 = sma(c, 20)[i], ma60 = sma(c, 60)[i], ma200 = sma(c, 200)[i];
const v5 = sma(v, 5)[i], v20 = sma(v, 20)[i];
const r5 = last(idx, 5), r20 = last(idx, 20), r60 = last(idx, 60);
const hh20 = Math.max(...c.slice(-21, -1));
const nearHigh = c[i] / hh20 - 1;
// 周线（≈25日）方向
const wma25 = sma(c, 25);
const weekUp = wma25[i] > wma25[i - 5];
// 恐慌代理：近5日单日≤-3%
const panic5 = idx.slice(-6, -1).some(x => x.close / x.open - 1 <= -0.03);
console.log('【① 大盘状态（上证综指 ' + c[i].toFixed(1) + '）】');
console.log(`  收盘 ${c[i].toFixed(1)} | MA20 ${ma20.toFixed(1)} | MA60 ${ma60.toFixed(1)} | MA200 ${ma200.toFixed(1)}`);
console.log(`  5日 ${(r5 * 100).toFixed(1)}% | 20日 ${(r20 * 100).toFixed(1)}% | 60日 ${(r60 * 100).toFixed(1)}% | 距20日高 ${(nearHigh * 100).toFixed(1)}%`);
console.log(`  量能比(5/20日均量) ${(v5 / v20).toFixed(2)} | 周线方向 ${weekUp ? '向上' : '向下'} | 近5日恐慌日 ${panic5 ? '有' : '无'}`);
const above = c[i] > ma20 && ma20 > ma60;
const ma20up = ma20 > sma(c, 20)[i - 5];
const strong = weekUp && c[i] > ma20 && ma20up && v5 > v20 * 1.1 && r20 > 0;
const exhaust = r20 > 0.12 && v5 < v20 * 0.9;
let state;
if (panic5 && !(c[i] > c[i - 1] && c[i] > c[i - 2])) state = '🌧️ 恐慌/弱势';
else if (strong) state = '🟢 健康趋势（量价配合）';
else if (weekUp && c[i] > ma20 && ma20up && r20 > 0) state = '🔵 趋势但强度不足（量能未配合，半档执行）';
else if (above && r20 > 0) state = '🔵 趋势（MA60压制中，谨慎半档）';
else if (exhaust) state = '🟠 趋势末段（动量钝化/缩量）';
else state = '⚪ 弱势/不明（等待周线修复）';
console.log(`  ▶ 状态判定：${state}`);
console.log(`  闸门：周线${weekUp ? '允许满档' : '向下 → 全部仓位×0.5'} | 索罗斯三条件代理：20日涨幅 ${(r20 * 100).toFixed(1)}% ${r20 > 0.15 ? '（>15% 需警惕衰竭）' : ''}\n`);

/* ② 板块热度 + 轮动 */
console.log('【② 板块热度排行与轮动】');
const heat = {};
for (const [sec, codes] of Object.entries(SECTORS)) {
  const r5a = avg(codes.map(x => last(series(x), 5)).filter(x => x != null));
  const r20a = avg(codes.map(x => last(series(x), 20)).filter(x => x != null));
  const r60a = avg(codes.map(x => last(series(x), 60)).filter(x => x != null));
  const vt = avg(codes.map(x => { const s = series(x); if (!s) return null; const vv = s.map(y => y.vol); const a = sma(vv, 5), b = sma(vv, 20); const k = s.length - 1; return a[k] && b[k] ? a[k] / b[k] - 1 : null; }).filter(x => x != null));
  heat[sec] = { r5: r5a, r20: r20a, r60: r60a, vt };
}
const hArr = Object.entries(heat).map(([k, v]) => [k, v.r5 * 0.45 + v.r20 * 0.30 + v.r60 * 0.15 + v.vt * 0.10]);
const vals = hArr.map(x => x[1]).sort((a, b) => a - b);
const norm = hArr.map(([k, x]) => [k, (x - vals[0]) / (vals[vals.length - 1] - vals[0]) * 100]).sort((a, b) => b[1] - a[1]);
for (const [k, x] of norm) {
  const tag = x >= 60 ? '🔥热' : x >= 40 ? '🌡️升温' : '❄️冷';
  console.log(`  ${k.padEnd(5)} 热度${x.toFixed(0).padStart(3)} ${tag}  5日${(heat[k].r5 * 100).toFixed(1).padStart(6)}% 20日${(heat[k].r20 * 100).toFixed(1).padStart(7)}% 60日${(heat[k].r60 * 100).toFixed(1).padStart(7)}% 量能${(heat[k].vt * 100).toFixed(1).padStart(6)}%`);
}
// 轮动判断：对比 5日 vs 60日
console.log('\n  轮动观察：5日强而60日弱 = 新启动（资金流入）；5日弱而60日强 = 退潮中');
const rot = Object.entries(heat).map(([k, v]) => [k, (v.r5 - v.r60) * 100]).sort((a, b) => b[1] - a[1]);
rot.forEach(([k, x]) => console.log(`  ${k.padEnd(5)} 5日-60日动量差 ${x.toFixed(1).padStart(6)}% ${x > 3 ? '← 新启动' : x < -3 ? '← 退潮' : ''}`));

/* ③ 系统符合性 */
console.log('\n【③ 符合交易系统的板块（热度≥60 + 状态闸门 + 量价结构）】');
const eligible = norm.filter(([k, x]) => x >= 60 && heat[k].r20 > -0.02);
for (const [k, x] of eligible) {
  const gate = weekUp ? '周线闸门✅' : '周线闸门⚠️(仓位×0.5)';
  console.log(`  ${k} 热度${x.toFixed(0)} ${gate} → 允许模式: ${k === '军工' ? 'P6龙头跟随+P1突破' : k === '医药' ? 'P1/P2（注意缩量）' : 'P1/P2'}`);
}

/* ④ 个股买卖点（v2.0 规则） */
console.log('\n【④ 候选个股买卖点（热板块内，v2.0 条件）】');
const picks = [];
for (const [sec, x] of eligible) {
  for (const code of SECTORS[sec]) {
    const s = series(code); if (!s) continue;
    const cc = s.map(y => y.close), vv = s.map(y => y.vol), k = cc.length - 1;
    const ma10 = sma(cc, 10)[k], ma20 = sma(cc, 20)[k], v5s = sma(vv, 5)[k];
    const hh20s = Math.max(...cc.slice(-21, -1));
    const mom20 = cc[k] / cc[k - 20] - 1;
    const volRatio = v5s ? vv[k] / v5s : 0;
    const nearH = cc[k] / hh20s - 1;
    const atr = (() => { const trs = []; for (let j = k - 14; j <= k; j++) trs.push(Math.max(s[j].high - s[j].low, Math.abs(s[j].high - s[j - 1].close), Math.abs(s[j].low - s[j - 1].close))); return avg(trs); })();
    const stop5 = cc[k] * 0.95, stopAtr = cc[k] - atr * 2;
    const stop = Math.max(stop5, stopAtr); // 取两者较近？实际取更高=更紧；取更保守=较高者
    const tight = Math.min(stop5, stopAtr);
    picks.push({ sec, code, name: NAMES[code] || code, px: cc[k], ma10, ma20, mom20, volRatio, nearH, atr, stop5, stopAtr, hh20s, s });
  }
}
picks.sort((a, b) => (b.volRatio - 1) - (a.volRatio - 1));
for (const p of picks) {
  const cond1 = p.px > p.ma20 ? '✅站上MA20' : '❌在MA20下';
  const cond2 = p.volRatio >= 1.5 ? '✅放量' : `量比${p.volRatio.toFixed(2)}`;
  const cond3 = p.mom20 > 0 ? '✅正动量' : '❌负动量';
  const near = p.nearH > -0.03 ? '贴近20日高' : `距高${(p.nearH * 100).toFixed(1)}%`;
  const entry = p.px > p.ma20 && p.volRatio >= 1.3 && p.mom20 > 0;
  console.log(`\n  ▸ ${p.name} ${p.code}（${p.sec}）现价 ${p.px.toFixed(2)}`);
  console.log(`    ${cond1} ${cond2} ${cond3} | 20日动量${(p.mom20 * 100).toFixed(1)}% | ${near}`);
  console.log(`    关键位: MA10 ${p.ma10.toFixed(2)} | MA20 ${p.ma20.toFixed(2)} | 20日高 ${p.hh20s.toFixed(2)} | ATR ${p.atr.toFixed(2)}`);
  console.log(`    入场触发: ${entry ? '✅ 已具备入场条件（' + (p.px > p.hh20s ? '创新高突破形态' : '突破回踩区') + '）' : '⏳ 等待: ' + (p.px <= p.ma20 ? '收复MA20 ' : '') + (p.volRatio < 1.5 ? '放量确认 ' : '') + (p.mom20 <= 0 ? '动量转正' : '')}`);
  console.log(`    止损: -5% = ${p.stop5.toFixed(2)} | ATR×2 = ${p.stopAtr.toFixed(2)}（取较紧 ${Math.max(p.stop5, p.stopAtr).toFixed(2)}，即亏${(((Math.max(p.stop5, p.stopAtr)) / p.px - 1) * 100).toFixed(1)}%）`);
  console.log(`    离场: 跌破MA10两日 或 跌破MA20两日 或 量增价滞 | 目标: +8% 分批止盈`);
}
console.log('\n══════════════════════════════════════════════════════════');
console.log('⚠️ 教学研究用途。数据为新浪日K（未复权），买卖点为规则化参考，非实时盘中信号。');
console.log('仓位按 v2.0 映射表：健康趋势满档75% / 强度不足半档40% / 周线向下×0.5；单笔风险≤2%。');
