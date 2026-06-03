/**
 * 基本面分析师 — 对应 Python 版 fundamentals_analyst.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { buildInstrumentContext, getLanguageInstruction } from '../utils'
import { getFundamentals, getBalanceSheet, getCashflow, getIncomeStatement, getProfitForecast, getIndustryComparison } from '../../data/a-stock'

const TOOLS = [
  {
    name: 'get_fundamentals',
    description: '获取公司基本面（PE/PB/市值等）',
    parameters: {
      type: 'object',
      properties: { ticker: { type: 'string' } },
      required: ['ticker'],
    },
  },
  {
    name: 'get_balance_sheet',
    description: '获取资产负债表',
    parameters: {
      type: 'object',
      properties: { ticker: { type: 'string' }, freq: { type: 'string' } },
      required: ['ticker'],
    },
  },
  {
    name: 'get_cashflow',
    description: '获取现金流量表',
    parameters: {
      type: 'object',
      properties: { ticker: { type: 'string' }, freq: { type: 'string' } },
      required: ['ticker'],
    },
  },
  {
    name: 'get_income_statement',
    description: '获取利润表',
    parameters: {
      type: 'object',
      properties: { ticker: { type: 'string' }, freq: { type: 'string' } },
      required: ['ticker'],
    },
  },
  {
    name: 'get_profit_forecast',
    description: '获取 EPS 一致预期',
    parameters: {
      type: 'object',
      properties: { ticker: { type: 'string' } },
      required: ['ticker'],
    },
  },
  {
    name: 'get_industry_comparison',
    description: '获取行业横向对比',
    parameters: {
      type: 'object',
      properties: { ticker: { type: 'string' }, trade_date: { type: 'string' } },
      required: ['ticker', 'trade_date'],
    },
  },
]

const SYSTEM_PROMPT = `你是一位专注于 A 股市场的基本面分析师。通过分析财务数据和行业对比，评估标的的基本面质量。

关注：
- 营收和利润增长趋势
- 资产负债结构和现金流
- PE/PB 估值水平
- 行业横向对比` + getLanguageInstruction()

export async function fundamentalsAnalystNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  quickModel: string,
): Promise<Partial<AgentState>> {
  const instrumentContext = buildInstrumentContext(state.companyOfInterest)
  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n当前日期: ${state.tradeDate}\n${instrumentContext}` },
    { role: 'user', content: `请分析 ${state.companyOfInterest} 的基本面` },
  ]

  let report = ''
  let maxRounds = 8
  while (maxRounds > 0) {
    maxRounds--
    const resp = await invokeLLM(quickModel, messages, apiKey, baseUrl, { tools: TOOLS })
    messages.push({ role: 'assistant', content: resp.content })

    if (resp.toolCalls && resp.toolCalls.length > 0) {
      for (const tc of resp.toolCalls) {
        let result = ''
        try {
          const args = tc.args as any
          if (tc.name === 'get_fundamentals') {
            result = await getFundamentals(args.ticker)
          } else if (tc.name === 'get_balance_sheet') {
            result = await getBalanceSheet(args.ticker, args.freq)
          } else if (tc.name === 'get_cashflow') {
            result = await getCashflow(args.ticker, args.freq)
          } else if (tc.name === 'get_income_statement') {
            result = await getIncomeStatement(args.ticker, args.freq)
          } else if (tc.name === 'get_profit_forecast') {
            result = await getProfitForecast(args.ticker)
          } else if (tc.name === 'get_industry_comparison') {
            result = await getIndustryComparison(args.ticker, state.tradeDate)
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

  return { fundamentalsReport: report }
}
