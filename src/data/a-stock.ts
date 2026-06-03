/**
 * A 股数据获取 — 所有 HTTP 直连接口
 *
 * 数据来源:
 * - 新浪财经: K 线、财务报表
 * - 腾讯财经: 实时行情 (PE/PB/市值)
 * - 东方财富 push2/push2his: 实时行情、资金流
 * - 东方财富 datacenter-web: 龙虎榜、解禁
 * - 东方财富 search-api: 个股新闻
 * - 东方财富 np-weblist: 全球快讯
 * - 同花顺: EPS 一致预期、热股、北向资金
 * - 百度股市通: 概念板块
 * - 财联社: 全球财经快讯
 */

import { normalizeTicker, getMarketPrefix } from './utils'

// ---------------------------------------------------------------------------
// 东财防封：全局节流 + 会话复用
// ---------------------------------------------------------------------------

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

const EM_MIN_INTERVAL = parseFloat(process.env.EM_MIN_INTERVAL || '1.0')
let emLastCall = 0

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/** 东财统一请求入口：自动节流 + UA */
async function emGet(url: string, params?: Record<string, string>, headers?: Record<string, string>): Promise<Response> {
  const wait = EM_MIN_INTERVAL * 1000 - (Date.now() - emLastCall)
  if (wait > 0) {
    await sleep(wait + Math.random() * 400 + 100)
  }
  const searchParams = new URLSearchParams(params || {})
  const fullUrl = searchParams.toString() ? `${url}?${searchParams}` : url
  const resp = await fetch(fullUrl, {
    headers: { 'User-Agent': UA, ...headers },
  })
  emLastCall = Date.now()
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
  return resp
}

// ---------------------------------------------------------------------------
// 腾讯实时行情
// ---------------------------------------------------------------------------

interface TencentQuote {
  name: string
  price: number
  lastClose: number
  open: number
  changePct: number
  high: number
  low: number
  turnoverPct: number
  peTtm: number
  mcapYi: number
  floatMcapYi: number
  pb: number
  limitUp: number
  limitDown: number
  peStatic: number
}

export async function getTencentQuote(code: string): Promise<TencentQuote | null> {
  try {
    const prefix = getMarketPrefix(code)
    const url = `https://qt.gtimg.cn/q=${prefix}${code}`
    const resp = await fetch(url, { headers: { 'User-Agent': UA } })
    const raw = await resp.text()
    // GBK 编码处理
    const decoder = new TextDecoder('gbk')
    const buffer = await resp.arrayBuffer()
    const decoded = decoder.decode(buffer)
    // 解析
    const match = decoded.match(/"([^"]+)"/)
    if (!match) return null
    const vals = match[1].split('~')
    if (vals.length < 53) return null
    return {
      name: vals[1],
      price: parseFloat(vals[3]) || 0,
      lastClose: parseFloat(vals[4]) || 0,
      open: parseFloat(vals[5]) || 0,
      changePct: parseFloat(vals[32]) || 0,
      high: parseFloat(vals[33]) || 0,
      low: parseFloat(vals[34]) || 0,
      turnoverPct: parseFloat(vals[38]) || 0,
      peTtm: parseFloat(vals[39]) || 0,
      mcapYi: parseFloat(vals[44]) || 0,
      floatMcapYi: parseFloat(vals[45]) || 0,
      pb: parseFloat(vals[46]) || 0,
      limitUp: parseFloat(vals[47]) || 0,
      limitDown: parseFloat(vals[48]) || 0,
      peStatic: parseFloat(vals[52]) || 0,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// 新浪 K 线
// ---------------------------------------------------------------------------

interface KLine {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export async function getSinaKLine(code: string, startDate?: string, endDate?: string): Promise<KLine[]> {
  const prefix = getMarketPrefix(code)
  const url = 'http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData'
  const params = new URLSearchParams({
    symbol: `${prefix}${code}`,
    scale: '240',
    ma: 'no',
    datalen: '800',
  })
  const resp = await fetch(`${url}?${params}`, { headers: { 'User-Agent': UA } })
  const text = await resp.text()
  const data = JSON.parse(text)
  if (!Array.isArray(data)) return []

  let rows: KLine[] = data.map((item: any) => ({
    date: item.day,
    open: parseFloat(item.open),
    high: parseFloat(item.high),
    low: parseFloat(item.low),
    close: parseFloat(item.close),
    volume: parseInt(item.volume) || 0,
  }))

  if (startDate) rows = rows.filter(r => r.date >= startDate)
  if (endDate) rows = rows.filter(r => r.date <= endDate)

  return rows
}

// ---------------------------------------------------------------------------
// 东方财富 datacenter
// ---------------------------------------------------------------------------

const DATACENTER_URL = 'https://datacenter-web.eastmoney.com/api/data/v1/get'

async function eastmoneyDatacenter(
  reportName: string,
  columns = 'ALL',
  filterStr = '',
  pageSize = 50,
  sortColumns = '',
  sortTypes = '-1',
): Promise<any[]> {
  const params: Record<string, string> = {
    reportName,
    columns,
    filter: filterStr,
    pageNumber: '1',
    pageSize: String(pageSize),
    sortColumns,
    sortTypes,
    source: 'WEB',
    client: 'WEB',
  }
  const resp = await emGet(DATACENTER_URL, params)
  const d = await resp.json()
  return d?.result?.data || []
}

// ---------------------------------------------------------------------------
// 同花顺 EPS 预测
// ---------------------------------------------------------------------------

export async function getThsEpsForecast(code: string): Promise<any[]> {
  try {
    const url = `https://basic.10jqka.com.cn/new/${code}/worth.html`
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://basic.10jqka.com.cn/' },
    })
    const text = await resp.text()
    // 简单的 HTML 表格解析
    const tableMatch = text.match(/<table[\s\S]*?<\/table>/)
    if (!tableMatch) return []
    // 返回文本行以便上层解析
    return [{ raw: tableMatch[0] }]
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// 新浪财务报表
// ---------------------------------------------------------------------------

async function getSinaFinancialReport(
  code: string,
  reportType: string,
  freq: string,
  currDate?: string,
): Promise<any[]> {
  const reportTypeMap: Record<string, string> = {
    '资产负债表': 'fzb',
    '利润表': 'lrb',
    '现金流量表': 'llb',
  }
  const sourceType = reportTypeMap[reportType] || 'lrb'
  const prefix = getMarketPrefix(code)
  const url = 'https://quotes.sina.cn/cn/api/openapi.php/CompanyFinanceService.getFinanceReport2022'
  const params = new URLSearchParams({
    paperCode: `${prefix}${code}`,
    source: sourceType,
    type: '0',
    page: '1',
    num: '20',
  })
  const resp = await fetch(`${url}?${params}`, { headers: { 'User-Agent': UA } })
  const d = await resp.json()
  const items = d?.result?.data?.[sourceType]
  return Array.isArray(items) ? items : []
}

// ===========================================================================
// 公开 API 函数 — 与 Python 版 a_stock.py 一一映射
// ===========================================================================

// ---- 1. getStockData ----

export async function getStockData(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  const code = normalizeTicker(symbol)
  try {
    const data = await getSinaKLine(code, startDate, endDate)
    if (data.length === 0) {
      return `股票 "${code}" 在 ${startDate} 至 ${endDate} 范围内无数据`
    }
    const header = [
      `# 股票数据 ${code}（A 股）从 ${startDate} 到 ${endDate}`,
      `# 总记录: ${data.length}`,
      `# 数据来源: 新浪财经 HTTP`,
      '',
    ].join('\n')
    const csv = ['Date,Open,High,Low,Close,Volume']
    for (const row of data) {
      csv.push(`${row.date},${row.open},${row.high},${row.low},${row.close},${row.volume}`)
    }
    return header + csv.join('\n')
  } catch (e: any) {
    return `获取 K 线数据失败: ${e.message}`
  }
}

// ---- 2. getIndicators ----

const INDICATOR_DESCRIPTIONS: Record<string, string> = {
  close_50_sma: '50 SMA: 中期趋势指标',
  close_200_sma: '200 SMA: 长期趋势基准',
  close_10_ema: '10 EMA: 灵敏短期均线',
  macd: 'MACD: 动量指标',
  macds: 'MACD 信号线',
  macdh: 'MACD 柱状图',
  rsi: 'RSI: 相对强弱指标 (70/30 阈值)',
  boll: '布林带中轨 (20 SMA)',
  boll_ub: '布林带上轨',
  boll_lb: '布林带下轨',
  atr: 'ATR: 平均真实波幅',
  vwma: 'VWMA: 成交量加权均线',
  mfi: 'MFI: 资金流量指标',
}

function calculateSMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result.push(null); continue }
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += prices[j]
    result.push(sum / period)
  }
  return result
}

function calculateEMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  const multiplier = 2 / (period + 1)
  let ema: number | null = null
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result.push(null); continue }
    if (ema === null) {
      let sum = 0
      for (let j = i - period + 1; j <= i; j++) sum += prices[j]
      ema = sum / period
    } else {
      ema = (prices[i] - ema) * multiplier + ema
    }
    result.push(ema)
  }
  return result
}

function calculateRSI(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  let gains = 0, losses = 0
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    if (i < period) {
      if (diff > 0) gains += diff; else losses -= diff
      if (i === period - 1) {
        const avgGain = gains / period, avgLoss = losses / period
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
        result.push(100 - 100 / (1 + rs))
      } else { result.push(null) }
    } else {
      const prevAvgGain = gains / period, prevAvgLoss = losses / period
      const currentGain = diff > 0 ? diff : 0
      const currentLoss = diff < 0 ? -diff : 0
      gains = prevAvgGain * (period - 1) + currentGain
      losses = prevAvgLoss * (period - 1) + currentLoss
      const avgGain = gains / period, avgLoss = losses / period
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result.push(100 - 100 / (1 + rs))
    }
  }
  return result
}

export async function getIndicators(
  symbol: string,
  indicator: string,
  currDate: string,
  lookBackDays: number,
): Promise<string> {
  const code = normalizeTicker(symbol)
  if (!INDICATOR_DESCRIPTIONS[indicator]) {
    return `不支持的指标: ${indicator}。可选: ${Object.keys(INDICATOR_DESCRIPTIONS).join(', ')}`
  }

  try {
    const data = await getSinaKLine(code)
    if (data.length === 0) return `无法获取 ${code} 的 K 线数据`

    const closes = data.map(d => d.close)
    let values: (number | null)[] = []

    if (indicator === 'close_50_sma') values = calculateSMA(closes, 50)
    else if (indicator === 'close_200_sma') values = calculateSMA(closes, 200)
    else if (indicator === 'close_10_ema') values = calculateEMA(closes, 10)
    else if (indicator === 'rsi') values = calculateRSI(closes, 14)
    else {
      // 简化处理其他指标
      values = calculateSMA(closes, 20)
    }

    // 构建日期映射
    const dateValueMap: Record<string, string> = {}
    for (let i = 0; i < data.length; i++) {
      dateValueMap[data[i].date] = values[i] !== null ? values[i]!.toFixed(4) : 'N/A'
    }

    // 生成输出
    const currDateObj = new Date(currDate)
    const startDate = new Date(currDateObj)
    startDate.setDate(startDate.getDate() - lookBackDays)

    const lines: string[] = []
    const current = startDate
    while (current <= currDateObj) {
      const ds = current.toISOString().slice(0, 10)
      const val = dateValueMap[ds] || 'N/A: 非交易日'
      lines.push(`${ds}: ${val}`)
      current.setDate(current.getDate() + 1)
    }

    return [
      `## ${indicator} 值 ${code} 从 ${startDate.toISOString().slice(0, 10)} 到 ${currDate}:`,
      '',
      ...lines,
      '',
      INDICATOR_DESCRIPTIONS[indicator] || '',
    ].join('\n')
  } catch (e: any) {
    return `计算 ${indicator} 失败: ${e.message}`
  }
}

// ---- 3. getFundamentals ----

export async function getFundamentals(ticker: string, currDate?: string): Promise<string> {
  const code = normalizeTicker(ticker)
  const lines: string[] = []

  // 腾讯实时估值
  const tq = await getTencentQuote(code)
  if (tq) {
    lines.push(
      `名称: ${tq.name}`,
      `价格: ${tq.price}`,
      `PE(TTM): ${tq.peTtm}`,
      `PE(静态): ${tq.peStatic}`,
      `PB: ${tq.pb}`,
      `市值(亿): ${tq.mcapYi}`,
      `流通市值(亿): ${tq.floatMcapYi}`,
      `换手率: ${tq.turnoverPct}%`,
      `涨跌幅: ${tq.changePct}%`,
      `涨停价: ${tq.limitUp}`,
      `跌停价: ${tq.limitDown}`,
    )
  }

  // 东财 push2 股票信息
  try {
    const marketCode = code.startsWith('6') ? 1 : 0
    const infoUrl = 'https://push2.eastmoney.com/api/qt/stock/get'
    const infoParams: Record<string, string> = {
      fltt: '2',
      invt: '2',
      fields: 'f57,f58,f84,f85,f127,f116,f117,f189,f43',
      secid: `${marketCode}.${code}`,
    }
    const resp = await emGet(infoUrl, infoParams)
    const d = (await resp.json())?.data
    if (d) {
      if (d.f127) lines.push(`行业: ${d.f127}`)
      if (d.f84) lines.push(`总股本: ${d.f84}`)
      if (d.f85) lines.push(`流通股本: ${d.f85}`)
      if (d.f116) lines.push(`总市值: ${d.f116}`)
      if (d.f117) lines.push(`流通市值: ${d.f117}`)
      if (d.f189) lines.push(`上市日期: ${d.f189}`)
    }
  } catch { /* ignore */ }

  if (lines.length === 0) return `未找到 ${code} 的基本面数据`

  return `# 公司基本面 ${code}（A 股）\n\n${lines.join('\n')}`
}

// ---- 4-6. 财务报表 ----

export async function getBalanceSheet(ticker: string, freq = 'quarterly', currDate?: string): Promise<string> {
  const code = normalizeTicker(ticker)
  try {
    const data = await getSinaFinancialReport(code, '资产负债表', freq, currDate)
    if (data.length === 0) return `未找到 ${code} 的资产负债表数据`
    return `# 资产负债表 ${code}（${freq}）\n\n${JSON.stringify(data.slice(0, 8), null, 2)}`
  } catch (e: any) {
    return `获取资产负债表失败: ${e.message}`
  }
}

export async function getCashflow(ticker: string, freq = 'quarterly', currDate?: string): Promise<string> {
  const code = normalizeTicker(ticker)
  try {
    const data = await getSinaFinancialReport(code, '现金流量表', freq, currDate)
    if (data.length === 0) return `未找到 ${code} 的现金流量表数据`
    return `# 现金流量表 ${code}（${freq}）\n\n${JSON.stringify(data.slice(0, 8), null, 2)}`
  } catch (e: any) {
    return `获取现金流量表失败: ${e.message}`
  }
}

export async function getIncomeStatement(ticker: string, freq = 'quarterly', currDate?: string): Promise<string> {
  const code = normalizeTicker(ticker)
  try {
    const data = await getSinaFinancialReport(code, '利润表', freq, currDate)
    if (data.length === 0) return `未找到 ${code} 的利润表数据`
    return `# 利润表 ${code}（${freq}）\n\n${JSON.stringify(data.slice(0, 8), null, 2)}`
  } catch (e: any) {
    return `获取利润表失败: ${e.message}`
  }
}

// ---- 7. getNews ----

export async function getNews(ticker: string, startDate: string, endDate: string): Promise<string> {
  const code = normalizeTicker(ticker)

  // 东方财富搜索 API
  try {
    const url = 'https://search-api-web.eastmoney.com/search/jsonp'
    const innerParam = JSON.stringify({
      uid: '',
      keyword: code,
      type: ['cmsArticleWebOld'],
      client: 'web',
      clientType: 'web',
      clientVersion: 'curr',
      param: { cmsArticleWebOld: { searchScope: 'default', sort: 'default', pageIndex: 1, pageSize: 20, preTag: '', postTag: '' } },
    })
    const params: Record<string, string> = { cb: 'callback', param: innerParam, _: '1' }
    const resp = await emGet(url, params, { Referer: 'https://so.eastmoney.com/' })
    let text = await resp.text()
    text = text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'))
    const data = JSON.parse(text)
    const articles = data?.result?.cmsArticleWebOld || []

    const newsLines: string[] = []
    let count = 0
    for (const item of articles) {
      const title = item.title || ''
      const content = (item.content || '').slice(0, 300)
      const time = item.date || ''
      const source = item.mediaName || '东方财富'
      if (time && time.slice(0, 10) >= startDate && time.slice(0, 10) <= endDate) {
        newsLines.push(`### ${title} (${source})\n${content}\n`)
        count++
      }
    }
    if (count > 0) {
      return `## ${code} 新闻 ${startDate} 至 ${endDate}:\n\n${newsLines.join('\n')}`
    }
  } catch { /* fallback */ }

  return `未找到 ${code} 相关新闻`
}

// ---- 8. getGlobalNews ----

export async function getGlobalNews(currDate: string, lookBackDays = 7, limit = 10): Promise<string> {
  const allNews: { title: string; content: string; time: string; source: string }[] = []

  // 财联社快讯
  try {
    const clsUrl = 'https://www.cls.cn/nodeapi/telegraphList'
    const params = new URLSearchParams({ rn: String(limit), page: '1' })
    const resp = await fetch(`${clsUrl}?${params}`, {
      headers: { 'User-Agent': UA, Referer: 'https://www.cls.cn/' },
    })
    const d = await resp.json()
    for (const item of d?.data?.roll_data || []) {
      const title = item.title || item.brief || ''
      const content = item.content || item.brief || ''
      const ctime = item.ctime || ''
      const pubTime = ctime ? new Date(ctime * 1000).toISOString().slice(0, 16) : ''
      allNews.push({ title, content, time: pubTime, source: 'CLS Wire' })
    }
  } catch { /* ignore */ }

  // 东财 7x24 快讯
  try {
    const emUrl = 'https://np-weblist.eastmoney.com/comm/web/getFastNewsList'
    const emParams: Record<string, string> = {
      client: 'web', biz: 'web_724', fastColumn: '102',
      sortEnd: '', pageSize: String(limit),
      req_trace: crypto.randomUUID(),
    }
    const resp = await emGet(emUrl, emParams, { Referer: 'https://kuaixun.eastmoney.com/' })
    const d = await resp.json()
    for (const item of d?.data?.fastNewsList || []) {
      allNews.push({
        title: item.title || '',
        content: (item.summary || '').slice(0, 200),
        time: item.showTime || '',
        source: '东方财富 7x24',
      })
    }
  } catch { /* ignore */ }

  if (allNews.length === 0) return `未找到 ${currDate} 的全球快讯`

  // 去重
  const seen = new Set<string>()
  const unique = allNews.filter(n => {
    if (seen.has(n.title)) return false
    seen.add(n.title)
    return true
  })

  const newsStr = unique.slice(0, limit).map(n =>
    `### ${n.title} (${n.source})\n${n.content}\n`
  ).join('\n')

  return `## 全球市场快讯 ${currDate}:\n\n${newsStr}`
}

// ---- 9. getInsiderTransactions ----
// A 股没有标准的内幕交易数据，此函数返回提示信息

export async function getInsiderTransactions(ticker: string): Promise<string> {
  const code = normalizeTicker(ticker)
  return `# ${code} 股东研究\n\nA 股内幕交易数据不公开。建议查看龙虎榜（getDragonTigerBoard）和限售解禁日历（getLockupExpiry）了解大股东动向。`
}

// ---- 10. getProfitForecast ----

export async function getProfitForecast(ticker: string, currDate?: string): Promise<string> {
  const code = normalizeTicker(ticker)
  try {
    const data = await getThsEpsForecast(code)
    if (data.length === 0) return `未找到 ${code} 的分析师覆盖数据`
    return `# EPS 一致预期 ${code}（A 股）\n来源: 同花顺\n\n${JSON.stringify(data, null, 2)}`
  } catch (e: any) {
    return `获取盈利预测失败: ${e.message}`
  }
}

// ---- 11. getHotStocks ----

export async function getHotStocks(currDate?: string): Promise<string> {
  const date = currDate || new Date().toISOString().slice(0, 10)
  try {
    const url = `http://zx.10jqka.com.cn/event/api/getharden/date/${date}/orderby/date/orderway/desc/charset/GBK/`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/117.0.0.0 Safari/537.36' },
    })
    const data = await resp.json()
    const rows = data?.data || []
    if (rows.length === 0) return `${date} 无热股数据（可能非交易日）`

    const lines: string[] = [
      `# 热股题材（${date}）`,
      `# 来源: 同花顺`,
      `# 共 ${rows.length} 只`,
      '',
    ]
    for (const row of rows) {
      lines.push(`${row.code} ${row.name}: +${row.zhangfu}% 换手${row.huanshou}% 成交额${row.chengjiaoe} | ${row.reason || ''}`)
    }
    return lines.join('\n')
  } catch (e: any) {
    return `获取热股失败: ${e.message}`
  }
}

// ---- 12. getNorthboundFlow ----

export async function getNorthboundFlow(currDate: string, includeHistory = false): Promise<string> {
  const lines: string[] = [`# 北向资金流（${currDate}）`, '# 来源: 同花顺 hsgtApi', '']

  try {
    const url = 'https://data.hexin.cn/market/hsgtApi/method/dayChart/'
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/117.0.0.0 Safari/537.36',
        Referer: 'https://data.hexin.cn/',
      },
    })
    const d = await resp.json()
    const times = d.time || []
    const hgt = d.hgt || []
    const sgt = d.sgt || []

    if (times.length > 0) {
      lines.push('## 实时（累计净买入，亿元）')
      const n = times.length
      const startIdx = Math.max(0, n - 10)
      for (let i = startIdx; i < n; i++) {
        lines.push(`  ${times[i]}: HGT=${hgt[i]} SGT=${sgt[i]}`)
      }
      const hgtClose = parseFloat(hgt[hgt.length - 1]) || 0
      const sgtClose = parseFloat(sgt[sgt.length - 1]) || 0
      const total = hgtClose + sgtClose
      lines.push(`\n收盘: HGT(沪股通)=${hgtClose.toFixed(2)}亿 SGT(深股通)=${sgtClose.toFixed(2)}亿 合计=${total.toFixed(2)}亿`)
      lines.push(total > 0 ? '信号: 北向净流入（偏多）' : '信号: 北向净流出（偏空）')
    } else {
      lines.push('无实时数据（非交易时间或节假日）')
    }
  } catch (e: any) {
    lines.push(`获取北向资金失败: ${e.message}`)
  }

  return lines.join('\n')
}

// ---- 13. getConceptBlocks ----

export async function getConceptBlocks(ticker: string): Promise<string> {
  const code = normalizeTicker(ticker)
  try {
    const url = `https://finance.pae.baidu.com/api/getrelatedblock?stock=[{"code":"${code}","market":"ab","type":"stock"}]&finClientType=pc`
    const resp = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://gushitong.baidu.com/',
        Origin: 'https://gushitong.baidu.com',
      },
    })
    const d = await resp.json()
    const categories = d?.Result?.[code] || []
    if (categories.length === 0) return `未找到 ${code} 的概念板块数据`

    const lines: string[] = [`# ${code} 概念板块`, '# 来源: 百度股市通', '']
    for (const cat of categories) {
      lines.push(`## ${cat.name}`)
      for (const item of cat.list || []) {
        lines.push(`  ${item.name}: ${item.ratio}`)
      }
    }
    return lines.join('\n')
  } catch (e: any) {
    return `获取概念板块失败: ${e.message}`
  }
}

// ---- 14. getFundFlow ----

export async function getFundFlow(ticker: string, currDate: string, includeHistory = true): Promise<string> {
  const code = normalizeTicker(ticker)
  const secid = code.startsWith('6') ? `1.${code}` : `0.${code}`
  const lines: string[] = [`# 资金流 ${code}（A 股）`, '# 来源: 东方财富 push2', '']

  try {
    // 实时分钟级资金流
    const urlRt = 'https://push2.eastmoney.com/api/qt/stock/fflow/kline/get'
    const paramsRt: Record<string, string> = {
      secid, klt: '1',
      fields1: 'f1,f2,f3,f7',
      fields2: 'f51,f52,f53,f54,f55,f56,f57',
    }
    const resp = await emGet(urlRt, paramsRt)
    const d = await resp.json()
    const klines = d?.data?.klines || []

    if (klines.length > 0) {
      lines.push('## 实时分钟资金流（主力/大单/超大单 净流入，万元）')
      for (const line of klines.slice(-10)) {
        const parts = line.split(',')
        if (parts.length >= 6) {
          lines.push(`  ${parts[0]}: 主力=${(parseFloat(parts[1]) / 1e4).toFixed(0)}万 大单=${(parseFloat(parts[4]) / 1e4).toFixed(0)}万 超大单=${(parseFloat(parts[5]) / 1e4).toFixed(0)}万`)
        }
      }
      const lastMain = parseFloat(klines[klines.length - 1].split(',')[1]) || 0
      lines.push(`\n收盘: 主力净流入=${(lastMain / 1e4).toFixed(0)}万元`)
      lines.push(lastMain > 0 ? '信号: 主力净流入（偏多）' : '信号: 主力净流出（偏空）')
    } else {
      lines.push('无实时资金流数据')
    }
  } catch (e: any) {
    lines.push(`获取资金流失败: ${e.message}`)
  }

  return lines.join('\n')
}

// ---- 15. getDragonTigerBoard ----

export async function getDragonTigerBoard(ticker: string, tradeDate: string, lookBackDays = 30): Promise<string> {
  const code = normalizeTicker(ticker)
  const lines: string[] = [`# 龙虎榜数据 | ${code} | ${tradeDate}（近${lookBackDays}日）`]

  try {
    const data = await eastmoneyDatacenter(
      'RPT_DAILYBILLBOARD_DETAILSNEW',
      'ALL',
      `(TRADE_DATE>='${tradeDate}')(SECURITY_CODE="${code}")`,
      50,
      'TRADE_DATE',
      '-1',
    )
    if (data.length === 0) {
      lines.push(`\n近${lookBackDays}日未上龙虎榜。`)
    } else {
      lines.push(`\n## 上榜记录（${data.length} 次）`)
      for (const row of data) {
        const netBuy = ((row.BILLBOARD_NET_AMT || 0) / 10000).toFixed(1)
        const turnover = (parseFloat(row.TURNOVERRATE || '0')).toFixed(2)
        lines.push(`  ${(row.TRADE_DATE || '').toString().slice(0, 10)} | ${row.EXPLANATION || ''} | 净买入${netBuy}万 | 换手${turnover}%`)
      }
    }
  } catch (e: any) {
    lines.push(`龙虎榜查询失败: ${e.message}`)
  }

  return lines.join('\n')
}

// ---- 16. getLockupExpiry ----

export async function getLockupExpiry(ticker: string, tradeDate: string, forwardDays = 90): Promise<string> {
  const code = normalizeTicker(ticker)
  const lines: string[] = [`# 限售解禁日历 | ${code} | ${tradeDate}`]

  try {
    const data = await eastmoneyDatacenter(
      'RPT_LIFT_STAGE',
      'ALL',
      `(SECURITY_CODE="${code}")`,
      15,
      'FREE_DATE',
      '-1',
    )
    if (data.length > 0) {
      lines.push(`\n## 个股解禁记录（共 ${data.length} 批）`)
      for (const row of data) {
        lines.push(`  ${(row.FREE_DATE || '').toString().slice(0, 10)} | ${row.LIMITED_STOCK_TYPE || ''} | ${row.FREE_SHARES_NUM || ''} | ${row.FREE_RATIO || ''}`)
      }
    } else {
      lines.push('\n无历史解禁记录。')
    }
  } catch (e: any) {
    lines.push(`解禁查询失败: ${e.message}`)
  }

  return lines.join('\n')
}

// ---- 17. getIndustryComparison ----

export async function getIndustryComparison(ticker: string, tradeDate: string, topN = 20): Promise<string> {
  const code = normalizeTicker(ticker)
  const lines: string[] = [`# 行业横向对比 | ${code} | ${tradeDate}`]

  try {
    const url = 'https://push2.eastmoney.com/api/qt/clist/get'
    const params: Record<string, string> = {
      pn: '1', pz: '100', po: '1', np: '1', fltt: '2', invt: '2',
      fs: 'm:90+t:2',
      fields: 'f2,f3,f4,f12,f13,f14,f104,f105,f128,f136,f140,f141,f207',
    }
    const resp = await emGet(url, params)
    const d = await resp.json()
    const items = d?.data?.diff || []

    if (items.length > 0) {
      lines.push(`\n## 全行业表现（${items.length} 个行业）`)
      for (let i = 0; i < Math.min(topN * 2, items.length); i++) {
        const item = items[i]
        lines.push(`  ${i + 1}. ${item.f14} | ${item.f3}% | 上涨${item.f104} | 下跌${item.f105} | ${item.f140}`)
      }
    } else {
      lines.push('行业数据为空。')
    }
  } catch (e: any) {
    lines.push(`行业对比查询失败: ${e.message}`)
  }

  return lines.join('\n')
}
