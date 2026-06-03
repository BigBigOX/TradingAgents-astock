/**
 * 游资追踪分析师（A 股特有）— 对应 Python 版 hot_money_tracker.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { buildInstrumentContext, getLanguageInstruction } from '../utils'
import { getNews, getInsiderTransactions, getHotStocks, getNorthboundFlow, getConceptBlocks, getFundFlow, getDragonTigerBoard, getIndustryComparison, getStockData } from '../../data/a-stock'

const TOOLS = [
  {
    name: 'get_stock_data', description: '获取 K 线数据',
    parameters: { type: 'object', properties: { symbol: { type: 'string' }, start_date: { type: 'string' }, end_date: { type: 'string' } }, required: ['symbol', 'start_date', 'end_date'] },
  },
  {
    name: 'get_news', description: '获取个股新闻',
    parameters: { type: 'object', properties: { ticker: { type: 'string' }, start_date: { type: 'string' }, end_date: { type: 'string' } }, required: ['ticker', 'start_date', 'end_date'] },
  },
  {
    name: 'get_insider_transactions', description: '获取股东研究',
    parameters: { type: 'object', properties: { ticker: { type: 'string' } }, required: ['ticker'] },
  },
  {
    name: 'get_hot_stocks', description: '获取热股题材',
    parameters: { type: 'object', properties: { curr_date: { type: 'string' } } },
  },
  {
    name: 'get_northbound_flow', description: '获取北向资金流',
    parameters: { type: 'object', properties: { curr_date: { type: 'string' } }, required: ['curr_date'] },
  },
  {
    name: 'get_concept_blocks', description: '获取概念板块归属',
    parameters: { type: 'object', properties: { ticker: { type: 'string' } }, required: ['ticker'] },
  },
  {
    name: 'get_fund_flow', description: '获取资金流',
    parameters: { type: 'object', properties: { ticker: { type: 'string' }, curr_date: { type: 'string' } }, required: ['ticker', 'curr_date'] },
  },
  {
    name: 'get_dragon_tiger_board', description: '获取龙虎榜',
    parameters: { type: 'object', properties: { ticker: { type: 'string' }, trade_date: { type: 'string' }, look_back_days: { type: 'number' } }, required: ['ticker', 'trade_date'] },
  },
  {
    name: 'get_industry_comparison', description: '获取行业对比',
    parameters: { type: 'object', properties: { ticker: { type: 'string' }, trade_date: { type: 'string' } }, required: ['ticker', 'trade_date'] },
  },
]

const SYSTEM_PROMPT = `你是一位专注于 A 股市场的游资追踪师。通过分析龙虎榜、资金流、北向资金等数据，判断资金动向。

关注：
- 龙虎榜席位分析（机构 vs 游资）
- 主力资金流向
- 北向资金动态
- 热点题材轮动` + getLanguageInstruction()

export async function hotMoneyAnalystNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  quickModel: string,
): Promise<Partial<AgentState>> {
  const instrumentContext = buildInstrumentContext(state.companyOfInterest)
  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n当前日期: ${state.tradeDate}\n${instrumentContext}` },
    { role: 'user', content: `请追踪 ${state.companyOfInterest} 的资金动向` },
  ]

  let report = ''
  let maxRounds = 8
  while (maxRounds > 0) {
    maxRounds--
    const resp = await invokeLLM(quickModel, messages, apiKey, baseUrl, { tools: TOOLS })
    messages.push({ role: 'assistant', content: resp.content, toolCalls: resp.toolCalls })

    if (resp.toolCalls && resp.toolCalls.length > 0) {
      for (const tc of resp.toolCalls) {
        let result = ''
        try {
          const args = tc.args as any
          if (tc.name === 'get_stock_data') result = await getStockData(args.symbol, args.start_date, args.end_date)
          else if (tc.name === 'get_news') result = await getNews(args.ticker, args.start_date, args.end_date)
          else if (tc.name === 'get_insider_transactions') result = await getInsiderTransactions(args.ticker)
          else if (tc.name === 'get_hot_stocks') result = await getHotStocks(args.curr_date)
          else if (tc.name === 'get_northbound_flow') result = await getNorthboundFlow(args.curr_date)
          else if (tc.name === 'get_concept_blocks') result = await getConceptBlocks(args.ticker)
          else if (tc.name === 'get_fund_flow') result = await getFundFlow(args.ticker, args.curr_date)
          else if (tc.name === 'get_dragon_tiger_board') result = await getDragonTigerBoard(args.ticker, args.trade_date, args.look_back_days || 30)
          else if (tc.name === 'get_industry_comparison') result = await getIndustryComparison(args.ticker, state.tradeDate)
        } catch (e: any) {
          result = `错误: ${e.message}`
        }
        messages.push({ role: 'tool', content: result, toolCallId: tc.id, name: tc.name })
      }
    } else {
      report = resp.content
      break
    }
  }

  return { hotMoneyReport: report }
}
