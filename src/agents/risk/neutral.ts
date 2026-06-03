/**
 * 中性风控（Neutral Debator）— 对应 Python 版 neutral_debator.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { getLanguageInstruction } from '../utils'

const SYSTEM_PROMPT = `你是一位 Neutral（中性）风险分析师。你平衡风险和收益。

角度：
- 综合多方观点
- 提出折中方案
- 注重风险收益比` + getLanguageInstruction()

export async function neutralDebatorNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  quickModel: string,
): Promise<Partial<AgentState>> {
  const riskState = state.riskDebateState
  const aggressiveView = riskState.aggressiveHistory ? `\n激进方观点:\n${riskState.aggressiveHistory}` : ''
  const conservativeView = riskState.conservativeHistory ? `\n保守方观点:\n${riskState.conservativeHistory}` : ''

  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n交易日期: ${state.tradeDate}\n标的: ${state.companyOfInterest}` },
    { role: 'user', content: `交易员方案:\n${state.traderInvestmentPlan}${aggressiveView}${conservativeView}\n\n请从中性视角评估风险，提出折中建议。` },
  ]

  const resp = await invokeLLM(quickModel, messages, apiKey, baseUrl)
  return {
    riskDebateState: {
      ...riskState,
      neutralHistory: resp.content,
      currentNeutralResponse: resp.content,
      latestSpeaker: 'Neutral',
      count: riskState.count + 1,
    },
  }
}
