/**
 * 激进来风控（Aggressive Debator）— 对应 Python 版 aggressive_debator.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { getLanguageInstruction } from '../utils'

const SYSTEM_PROMPT = `你是一位 Aggressive（激进型）风险分析师。你倾向于接受风险，认为高风险高回报。

角度：
- 关注上行空间为主
- 认为市场回调是买入机会
- 倾向于扩大仓位` + getLanguageInstruction()

export async function aggressiveDebatorNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  quickModel: string,
): Promise<Partial<AgentState>> {
  const riskState = state.riskDebateState

  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n交易日期: ${state.tradeDate}\n标的: ${state.companyOfInterest}` },
    { role: 'user', content: `交易员方案:\n${state.traderInvestmentPlan}\n\n请从激进视角评估风险。` },
  ]

  const resp = await invokeLLM(quickModel, messages, apiKey, baseUrl)
  return {
    riskDebateState: {
      ...riskState,
      aggressiveHistory: resp.content,
      currentAggressiveResponse: resp.content,
      latestSpeaker: 'Aggressive',
      count: riskState.count + 1,
    },
  }
}
