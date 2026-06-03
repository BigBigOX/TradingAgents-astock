/**
 * 市场分析师（技术面）— 对应 Python 版 market_analyst.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { buildInstrumentContext, getLanguageInstruction } from '../utils'
import { getStockData, getIndicators } from '../../data/a-stock'

const SYSTEM_PROMPT = `你是一位专注于 A 股市场的技术分析师。你的任务是从技术指标中选择最相关的指标，为给定的 A 股标的提供技术面分析。

A 股市场特殊规则：
- 涨跌停制度：主板 ±10%，科创板/创业板 ±20%，ST 股 ±5%
- T+1 交易制度：当日买入次日才能卖出
- 量价关系：A 股"量在价先"规律显著

操作要求：
1. 先调用 get_stock_data 获取 K 线数据
2. 再调用 get_indicators 获取选定指标
3. 撰写详细的技术分析报告` + getLanguageInstruction()

const TOOLS = [
  {
    name: 'get_stock_data',
    description: '获取 OHLCV K 线数据',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
      },
      required: ['symbol', 'start_date', 'end_date'],
    },
  },
  {
    name: 'get_indicators',
    description: '获取技术指标',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        indicator: { type: 'string' },
        curr_date: { type: 'string' },
        look_back_days: { type: 'number' },
      },
      required: ['symbol', 'indicator', 'curr_date', 'look_back_days'],
    },
  },
]

export async function marketAnalystNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  quickModel: string,
): Promise<Partial<AgentState>> {
  const currentDate = state.tradeDate
  const instrumentContext = buildInstrumentContext(state.companyOfInterest)

  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n当前日期: ${currentDate}\n${instrumentContext}` },
    { role: 'user', content: `请分析 ${state.companyOfInterest}` },
  ]

  let report = ''
  let maxRounds = 5

  while (maxRounds > 0) {
    maxRounds--
    const resp = await invokeLLM(quickModel, messages, apiKey, baseUrl, { tools: TOOLS })

    messages.push({ role: 'assistant', content: resp.content, toolCalls: resp.toolCalls })

    if (resp.toolCalls && resp.toolCalls.length > 0) {
      for (const tc of resp.toolCalls) {
        let result = ''
        try {
          const args = tc.args as any
          if (tc.name === 'get_stock_data') {
            result = await getStockData(args.symbol, args.start_date, args.end_date)
          } else if (tc.name === 'get_indicators') {
            result = await getIndicators(args.symbol, args.indicator, args.curr_date, args.look_back_days)
          }
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

  return { marketReport: report }
}
