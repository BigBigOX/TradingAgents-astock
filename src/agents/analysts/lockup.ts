/**
 * 解禁监控分析师（A 股特有）— 对应 Python 版 lockup_watcher.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { buildInstrumentContext, getLanguageInstruction } from '../utils'
import { getInsiderTransactions, getNews, getFundamentals, getLockupExpiry } from '../../data/a-stock'

const TOOLS = [
  {
    name: 'get_insider_transactions',
    description: '获取股东研究信息',
    parameters: { type: 'object', properties: { ticker: { type: 'string' } }, required: ['ticker'] },
  },
  {
    name: 'get_news',
    description: '获取个股新闻（关注增减持公告）',
    parameters: { type: 'object', properties: { ticker: { type: 'string' }, start_date: { type: 'string' }, end_date: { type: 'string' } }, required: ['ticker', 'start_date', 'end_date'] },
  },
  {
    name: 'get_fundamentals',
    description: '获取公司基本面',
    parameters: { type: 'object', properties: { ticker: { type: 'string' } }, required: ['ticker'] },
  },
  {
    name: 'get_lockup_expiry',
    description: '获取限售解禁日历',
    parameters: { type: 'object', properties: { ticker: { type: 'string' }, trade_date: { type: 'string' }, forward_days: { type: 'number' } }, required: ['ticker', 'trade_date'] },
  },
]

const SYSTEM_PROMPT = `你是一位专注于 A 股市场的解禁监控师。通过分析限售股解禁和股东增减持情况，评估解禁压力。

关注：
- 未来 90 天内的限售股解禁
- 大股东增减持动向
- 解禁对股价的潜在冲击` + getLanguageInstruction()

export async function lockupAnalystNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  quickModel: string,
): Promise<Partial<AgentState>> {
  const instrumentContext = buildInstrumentContext(state.companyOfInterest)
  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n当前日期: ${state.tradeDate}\n${instrumentContext}` },
    { role: 'user', content: `请分析 ${state.companyOfInterest} 的解禁和增减持风险` },
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
          if (tc.name === 'get_insider_transactions') result = await getInsiderTransactions(args.ticker)
          else if (tc.name === 'get_news') result = await getNews(args.ticker, args.start_date, args.end_date)
          else if (tc.name === 'get_fundamentals') result = await getFundamentals(args.ticker)
          else if (tc.name === 'get_lockup_expiry') result = await getLockupExpiry(args.ticker, args.trade_date, args.forward_days || 90)
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

  return { lockupReport: report }
}
