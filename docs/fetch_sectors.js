// fetch_sectors.js — 板块热度研究数据下载
// ① 8大板块成分股（新浪个股K线） ② 4只指数ETF（现货代理） ③ 股指/商品期货主力（新浪期货日K）
const fs = require('fs');
const path = require('path');
const UA = 'Mozilla/5.0';

const SECTORS = {
  '白酒':  ['600519', '000858', '000568', '002304'],
  '银行':  ['000001', '600036', '601398', '601288'],
  '证券':  ['600030', '601688', '600837', '601995'],
  '新能源': ['300750', '002594', '300014', '002460'],
  '半导体': ['688981', '002371', '603501', '688012'],
  '医药':  ['600276', '300760', '603259', '000538'],
  '军工':  ['600893', '000768', '600760', '601989'],
  '算力AI': ['002230', '603019', '000977', '688041'],
};
const STOCK_NAMES = { '600519':'贵州茅台','000858':'五粮液','000568':'泸州老窖','002304':'洋河股份',
  '000001':'平安银行','600036':'招商银行','601398':'工商银行','601288':'农业银行',
  '600030':'中信证券','601688':'华泰证券','600837':'海通证券','601995':'中金公司',
  '300750':'宁德时代','002594':'比亚迪','300014':'亿纬锂能','002460':'赣锋锂业',
  '688981':'中芯国际','002371':'北方华创','603501':'韦尔股份','688012':'中微公司',
  '600276':'恒瑞医药','300760':'迈瑞医疗','603259':'药明康德','000538':'云南白药',
  '600893':'航发动力','000768':'中航西飞','600760':'中航沈飞','601989':'中国重工',
  '002230':'科大讯飞','603019':'中科曙光','000977':'浪潮信息','688041':'海光信息' };
const ETFS = { 'sh510300':'沪深300ETF','sh510050':'上证50ETF','sh510500':'中证500ETF','sz159915':'创业板ETF' };
const FUTURES = { 'IF0':'沪深300股指期货(主力)','IC0':'中证500股指期货(主力)','IM0':'中证1000股指期货(主力)','AU0':'沪金期货(主力)','RB0':'螺纹钢期货(主力)','CU0':'沪铜期货(主力)' };

async function sinaStock(sym) {
  const url = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${sym}&scale=240&ma=no&datalen=1500`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://finance.sina.com.cn' } });
  const j = await r.json();
  if (!j || !j.length) throw new Error('empty');
  return j.map(k => [k.day, +k.open, +k.high, +k.low, +k.close, +k.volume]);
}
async function sinaFuture(sym) {
  const url = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20t=/InnerFuturesNewService.getDailyKLine?symbol=${sym}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://finance.sina.com.cn' } });
  const t = await r.text();
  const m = t.match(/\[\(\{[\s\S]*?\}\)\]/);
  if (!m) throw new Error('parse fail');
  const arr = eval(m[0]); // 形如 [{"d":"2017-01-17","o":...,"h":...,"l":...,"c":...,"v":...}]
  if (!arr || !arr.length) throw new Error('empty');
  return arr.map(k => [k.d, +k.o, +k.h, +k.l, +k.c, +(k.v || 0)]);
}

(async () => {
  const meta = {};
  const write = (code, rows, src) => {
    rows.sort((a, b) => a[0] < b[0] ? -1 : 1);
    const csv = 'Date,Open,High,Low,Close,Volume\n' + rows.map(r => r.join(',')).join('\n');
    fs.writeFileSync(path.join(__dirname, `data_${code}.csv`), csv);
    meta[code] = { source: src, rows: rows.length, first: rows[0][0], last: rows[rows.length - 1][0] };
    console.log(`${code}: ${rows.length} (${meta[code].first} → ${meta[code].last})`);
  };
  const withRetry = async (fn) => { for (let i = 0; i < 3; i++) { try { return await fn(); } catch (e) { await new Promise(r => setTimeout(r, 4000)); } } return null; };

  for (const [sec, codes] of Object.entries(SECTORS)) {
    for (const c of codes) {
      const rows = await withRetry(() => sinaStock((c.startsWith('6') ? 'sh' : 'sz') + c));
      if (rows) write(c, rows, `新浪财经个股K线 (${c} ${STOCK_NAMES[c]||''} · ${sec})`);
      await new Promise(r => setTimeout(r, 1200));
    }
  }
  for (const [sym, name] of Object.entries(ETFS)) {
    const rows = await withRetry(() => sinaStock(sym));
    if (rows) write(sym, rows, `新浪财经ETF日K (${name})`);
    await new Promise(r => setTimeout(r, 1200));
  }
  for (const [sym, name] of Object.entries(FUTURES)) {
    const rows = await withRetry(() => sinaFuture(sym));
    if (rows) write(sym, rows, `新浪财经期货日K (${name})`);
    await new Promise(r => setTimeout(r, 1500));
  }
  fs.writeFileSync(path.join(__dirname, 'data_sectors_meta.json'), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(__dirname, 'data_sectors_def.json'), JSON.stringify({ SECTORS, STOCK_NAMES, ETFS, FUTURES }, null, 2));
  console.log('done, meta saved');
})();
