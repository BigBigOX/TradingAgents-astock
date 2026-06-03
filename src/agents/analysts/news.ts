/**
 * 新闻分析师 — 对应 Python 版 news_analyst.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { buildInstrumentContext, getLanguageInstruction } from '../utils'
import { getNews, getGlobalNews, getInsiderTransactions } from '../../data/a-stock'

const TOOLS = [
  {
    name: 'get_news',
    description: '获取个股新闻',
    parameters: {
      type: 'object',
      properties: {
        ticker: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
      },
      required: ['ticker', 'start_date', 'end_date'],
    },
  },
  {
    name: 'get_global_news',
    description: '获取全球市场快讯',
    parameters: {
      type: 'object',
      properties: {
        curr_date: { type: 'string' },
        look_back_days: { type: 'number' },
        limit: { type: 'number' },
      },
      required: ['curr_date'],
    },
  },
  {
    name: 'get_insider_transactions',
    description: '获取股东研究信息',
    parameters: {
      type: 'object',
      properties: { ticker: { type: 'string' } },
      required: ['ticker'],
    },
  },
]

const SYSTEM_PROMPT = `你是一位专注于 A 股市场的新闻分析师。你的任务是通过分析个股新闻、全球快讯和股东变化，评估新闻面的多空影响。

A 股特点：
- 政策新闻对 A 股影响显著
- 关注龙虎榜和大股东增减持信号` + getLanguageInstruction()

export async function newsAnalystNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  quickModel: string,
): Promise<Partial<AgentState>> {
  const instrumentContext = buildInstrumentContext(state.companyOfInterest)
  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n当前日期: ${state.tradeDate}\n${instrumentContext}` },
    { role: 'user', content: `请分析 ${state.companyOfInterest} 的新闻面` },
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
          if (tc.name === 'get_news') {
            result = await getNews(args.ticker, args.start_date, args.end_date)
          } else if (tc.name === 'get_global_news') {
            result = await getGlobalNews(args.curr_date, args.look_back_days, args.limit)
          } else if (tc.name === 'get_insider_transactions') {
            result = await getInsiderTransactions(args.ticker)
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

  return { newsReport: report }
}
