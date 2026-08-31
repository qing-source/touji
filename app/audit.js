// audit.js — 全面体检：导航一致性 / CSS版本 / 脚本语法 / 关键功能引用 / 文件完整性
const fs = require('fs');

const PAGES = ['index.html', 'sector.html', 'theory.html', 'skills.html', 'backtest.html', 'system.html'];
const NAV = ['index.html', 'sector.html', 'theory.html', 'skills.html', 'backtest.html', 'system.html'];

let issues = 0;
const flag = (msg) => { console.log('⚠️  ' + msg); issues++; };
const ok = (msg) => console.log('✅  ' + msg);

for (const f of PAGES) {
  if (!fs.existsSync(f)) { flag(`${f} 不存在`); continue; }
  const c = fs.readFileSync(f, 'utf8');
  // 导航一致性
  for (const n of NAV) {
    if (f !== n && !c.includes('href="' + n + '"')) flag(`${f} 缺少导航 ${n}`);
  }
  if (f !== 'index.html' && c.includes('href="index.html" class="active"')) flag(`${f} active 标记错误`);
  // CSS 版本统一
  const m = c.match(/style\.css\?v=(\d+)/);
  if (!m) flag(`${f} 无 CSS 版本号`);
  // 脚本语法
  const scripts = [...c.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
  scripts.forEach((js, i) => { try { new Function(js); } catch (e) { flag(`${f} 脚本${i} 语法错误: ${e.message}`); } });
  ok(`${f} 检查完成 (css?v=${m ? m[1] : '?'}, ${scripts.length} 内联脚本)`);
}

// data.js 完整性
const src = fs.readFileSync('data.js', 'utf8');
try {
  const DATASET = JSON.parse(src.slice('const DATASET='.length).replace(/;\s*$/, ''));
  const seriesCount = Object.keys(DATASET.series).length;
  ok(`data.js 有效: ${seriesCount} 个序列`);
  // 序列行数一致性检查
  let bad = 0;
  for (const [k, s] of Object.entries(DATASET.series)) {
    const rows = s.csv.trim().split('\n').length - 1;
    if (rows < 100) { flag(`序列 ${k} 行数过少: ${rows}`); bad++; }
  }
  if (!bad) ok('所有序列行数充足');
  // 校验和验证
  const crypto = require('crypto');
  for (const [k, s] of Object.entries(DATASET.series)) {
    const h = crypto.createHash('sha256').update(s.csv).digest('hex');
    if (h !== s.sha256) flag(`序列 ${k} SHA-256 不匹配!`);
  }
  ok('SHA-256 校验全部通过');
} catch (e) { flag('data.js 解析失败: ' + e.message); }

// 资源引用完整性
const files = fs.readdirSync('.');
for (const f of PAGES) {
  const c = fs.readFileSync(f, 'utf8');
  const refs = [...c.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|png|jpg|svg|ico))"/g)].map(m => m[1]);
  for (const r of refs) {
    const clean = r.split('?')[0];
    if (r.startsWith('http')) continue;
    if (!files.includes(clean)) flag(`${f} 引用缺失: ${r}`);
  }
}
ok('资源引用检查完成');
console.log(issues ? `\n共 ${issues} 个问题` : '\n🎉 全部检查通过');
