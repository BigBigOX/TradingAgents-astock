/**
 * 社交媒体/情绪分析师 — 对应 Python 版 social_media_analyst.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { buildInstrumentContext, getLanguageInstruction } from '../utils'
import { getNews } from '../../data/a-stock'

const TOOLS = [
  {
    name: 'get_news',
    description: '获取个股新闻（含社交媒体情绪）',
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
]

const SYSTEM_PROMPT = `你是一位专注于 A 股市场情绪的社交媒体分析师。通过分析市场情绪，判断投资者情绪的多空倾向。

关注：
- 市场整体情绪指标
- 投资者关注度和讨论热度` + getLanguageInstruction()

export async function socialMediaAnalystNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  quickModel: string,
): Promise<Partial<AgentState>> {
  const instrumentContext = buildInstrumentContext(state.companyOfInterest)
  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n当前日期: ${state.tradeDate}\n${instrumentContext}` },
    { role: 'user', content: `请分析 ${state.companyOfInterest} 的市场情绪` },
  ]

  let report = ''
  let maxRounds = 5
  while (maxRounds > 0) {
    maxRounds--
    const resp = await invokeLLM(quickModel, messages, apiKey, baseUrl, { tools: TOOLS })
    messages.push({ role: 'assistant', content: resp.content })

    if (resp.toolCalls && resp.toolCalls.length > 0) {
      for (const tc of resp.toolCalls) {
        let result = ''
        try {
          if (tc.name === 'get_news') {
            const args = tc.args as any
            result = await getNews(args.ticker, args.start_date, args.end_date)
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

  return { sentimentReport: report }
}
