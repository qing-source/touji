// finalize.js — 统一 CSS 版本 v6 + 全页面运行时验证（DOM 桩）
const fs = require('fs');
const vm = require('vm');

const PAGES = ['index.html', 'sector.html', 'news.html', 'theory.html', 'skills.html', 'backtest.html', 'system.html'];

// 1) 统一 CSS 版本
for (const f of PAGES) {
  let c = fs.readFileSync(f, 'utf8');
  const m = c.match(/style\.css\?v=(\d+)/);
  if (m) {
    if (m[1] !== '6') { c = c.replace('style.css?v=' + m[1], 'style.css?v=6'); fs.writeFileSync(f, c); console.log(`${f}: css v${m[1]} → v6`); }
    else console.log(`${f}: css v6 已最新`);
  } else console.log(`${f}: 无 css 版本号!`);
}

// 2) 运行时验证：对含内联脚本且引用 data.js 的页面做 DOM 桩执行
const src = fs.readFileSync('data.js', 'utf8');
const DATASET = JSON.parse(src.slice('const DATASET='.length).replace(/;\s*$/, ''));
const el = () => ({ _h: '', set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, set textContent(v) { this._h = v; }, get textContent() { return this._h; }, style: {} });
const makeEls = () => ({ map: {}, get(id) { if (!this.map[id]) this.map[id] = el(); return this.map[id]; } });
const localStorageStub = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } };

for (const f of PAGES) {
  const html = fs.readFileSync(f, 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const logic = scripts.find(s => s.includes('DATASET') || s.includes('document.getElementById')) || scripts[0];
  if (!logic || logic.includes('new Function')) continue;
  const els = makeEls();
  const ctx = {
    console, Math, JSON, Object, Array, String, Number, Date, localStorage: localStorageStub, alert: () => {}, confirm: () => true,
    document: {
      getElementById: id => els.get(id),
      querySelectorAll: () => [], querySelector: () => null,
      createElement: () => el(),
    },
    window: { addEventListener: () => {}, },
    addEventListener: () => {}, DATASET,
  };
  ctx.window = ctx;
  try {
    vm.runInNewContext(logic, ctx);
    // 触发关键初始化函数（如果页面有自动执行路径则已执行）
    console.log(`${f}: 运行时 OK (DOM 桩)`);
  } catch (e) {
    console.log(`${f}: 运行时 ERR → ${e.message.slice(0, 120)}`);
  }
}
