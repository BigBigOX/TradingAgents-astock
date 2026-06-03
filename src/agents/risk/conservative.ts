/**
 * 保守型风控（Conservative Debator）— 对应 Python 版 conservative_debator.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { getLanguageInstruction } from '../utils'

const SYSTEM_PROMPT = `你是一位 Conservative（保守型）风险分析师。你优先考虑风险控制。

角度：
- 关注下行风险为主
- 建议设置更严格的止损
- 倾向于降低仓位暴露` + getLanguageInstruction()

export async function conservativeDebatorNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  quickModel: string,
): Promise<Partial<AgentState>> {
  const riskState = state.riskDebateState
  const aggressiveView = riskState.aggressiveHistory ? `\n激进方观点:\n${riskState.aggressiveHistory}` : ''

  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n交易日期: ${state.tradeDate}\n标的: ${state.companyOfInterest}` },
    { role: 'user', content: `交易员方案:\n${state.traderInvestmentPlan}${aggressiveView}\n\n请从保守视角评估风险。` },
  ]

  const resp = await invokeLLM(quickModel, messages, apiKey, baseUrl)
  return {
    riskDebateState: {
      ...riskState,
      conservativeHistory: resp.content,
      currentConservativeResponse: resp.content,
      latestSpeaker: 'Conservative',
      count: riskState.count + 1,
    },
  }
}
