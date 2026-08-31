// build_data.js — 将 CSV（指数+个股+板块成分+ETF+期货）嵌入 data.js（含来源与 SHA-256 校验和）
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'data_meta.json'), 'utf8'));
const stockMeta = JSON.parse(fs.readFileSync(path.join(__dirname, 'data_stocks_meta.json'), 'utf8'));
const sectMeta = JSON.parse(fs.readFileSync(path.join(__dirname, 'data_sectors_meta.json'), 'utf8'));
const sectDef = JSON.parse(fs.readFileSync(path.join(__dirname, 'data_sectors_def.json'), 'utf8'));
const out = { generated: new Date().toISOString(), series: {} };

const indexNames = { shc: '上证综指', hsi: '恒生指数', spx: '标普500' };
for (const name of ['shc', 'hsi', 'spx']) {
  const csv = fs.readFileSync(path.join(__dirname, `data_${name}.csv`), 'utf8');
  out.series[name] = { ...meta[name], name: indexNames[name], sha256: crypto.createHash('sha256').update(csv).digest('hex'), csv };
}
for (const code of Object.keys(stockMeta)) {
  const csv = fs.readFileSync(path.join(__dirname, `data_${code}.csv`), 'utf8');
  out.series[code] = { ...stockMeta[code], code, sha256: crypto.createHash('sha256').update(csv).digest('hex'), csv };
}
for (const code of Object.keys(sectMeta)) {
  if (out.series[code]) continue; // 避免覆盖（shc/hsi/spx 或已有个股）
  const csv = fs.readFileSync(path.join(__dirname, `data_${code}.csv`), 'utf8');
  out.series[code] = { ...sectMeta[code], code, sha256: crypto.createHash('sha256').update(csv).digest('hex'), csv };
}
out.sectors = sectDef.SECTORS;
out.names = sectDef.STOCK_NAMES;
fs.writeFileSync(path.join(__dirname, 'data.js'), 'const DATASET=' + JSON.stringify(out) + ';');
console.log('data.js written:', Object.keys(out.series).length, 'series;', Object.keys(out.sectors).length, 'sectors');
