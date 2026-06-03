/**
 * 交易员（Trader）— 对应 Python 版 trader.py
 */

import type { AgentState } from '../schemas/state'
import { invokeLLM, type ChatMessage } from '../llm/client'
import { buildInstrumentContext, getLanguageInstruction } from './utils'
import { renderTraderProposal, type TraderProposal } from '../schemas'

const SYSTEM_PROMPT = `你是一位交易员。阅读研究主管的投资计划和分析师报告，将其转化为具体的交易方案。

方案要素：
- 操作方向：Buy / Hold / Sell
- 理由
- 入场价（可选）
- 止损价（可选）
- 仓位建议

请以 JSON 格式输出，字段: action, reasoning, entryPrice(可选), stopLoss(可选), positionSizing(可选)` + getLanguageInstruction()

export async function traderNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  quickModel: string,
): Promise<Partial<AgentState>> {
  const instrumentContext = buildInstrumentContext(state.companyOfInterest)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\n${instrumentContext}\n\n交易日期: ${state.tradeDate}`,
    },
    {
      role: 'user',
      content: `研究主管的投资计划:\n${state.investmentPlan}\n\n请制定具体的交易方案。`,
    },
  ]

  const resp = await invokeLLM(quickModel, messages, apiKey, baseUrl, {
    responseSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['Buy', 'Hold', 'Sell'] },
        reasoning: { type: 'string' },
        entryPrice: { type: 'number' },
        stopLoss: { type: 'number' },
        positionSizing: { type: 'string' },
      },
      required: ['action', 'reasoning'],
    },
  })

  try {
    const proposal = JSON.parse(resp.content) as TraderProposal
    return { traderInvestmentPlan: renderTraderProposal(proposal) }
  } catch {
    return { traderInvestmentPlan: resp.content }
  }
}
