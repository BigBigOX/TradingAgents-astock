/**
 * 政策分析师（A 股特有）— 对应 Python 版 policy_analyst.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { buildInstrumentContext, getLanguageInstruction } from '../utils'
import { getNews, getGlobalNews } from '../../data/a-stock'

const TOOLS = [
  {
    name: 'get_news',
    description: '获取个股新闻（关注政策相关内容）',
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
    description: '获取全球市场快讯（关注政策动态）',
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
]

const SYSTEM_PROMPT = `你是一位专注于 A 股市场的政策分析师。分析宏观政策、行业政策对标的的潜在影响。

关注：
- 近期发布的宏观政策（货币政策、财政政策）
- 行业监管政策变化
- 产业政策扶持方向
- 政策风险评估` + getLanguageInstruction()

export async function policyAnalystNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  quickModel: string,
): Promise<Partial<AgentState>> {
  const instrumentContext = buildInstrumentContext(state.companyOfInterest)
  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n当前日期: ${state.tradeDate}\n${instrumentContext}` },
    { role: 'user', content: `请分析 ${state.companyOfInterest} 的政策面影响` },
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

  return { policyReport: report }
}
