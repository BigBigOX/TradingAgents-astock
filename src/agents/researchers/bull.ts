/**
 * 多头研究者（Bull Researcher）— 对应 Python 版 bull_researcher.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { getLanguageInstruction } from '../utils'

const SYSTEM_PROMPT = `你是一位 Bull（看多）投资者，正在参与一场投资辩论。你的任务是坚定地站在看多方，利用分析师报告中的看多证据来支持你的立场。

辩论规则：
- 基于分析师报告中的数据支持看多观点
- 对熊方的论点进行反驳
- 保持专业和理性` + getLanguageInstruction()

export async function bullResearcherNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  deepModel: string,
): Promise<Partial<AgentState>> {
  const debateState = state.investmentDebateState
  const reports = [
    state.marketReport && `## 市场分析\n${state.marketReport}`,
    state.sentimentReport && `## 情绪分析\n${state.sentimentReport}`,
    state.newsReport && `## 新闻分析\n${state.newsReport}`,
    state.fundamentalsReport && `## 基本面分析\n${state.fundamentalsReport}`,
    state.policyReport && `## 政策分析\n${state.policyReport}`,
    state.hotMoneyReport && `## 资金分析\n${state.hotMoneyReport}`,
    state.lockupReport && `## 解禁分析\n${state.lockupReport}`,
  ].filter(Boolean).join('\n\n')

  const bearArgs = debateState.bearHistory ? `\n\n熊方观点:\n${debateState.bearHistory}` : ''

  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n交易日期: ${state.tradeDate}\n标的: ${state.companyOfInterest}` },
    { role: 'user', content: `请基于以下分析师报告提出看多观点:\n\n${reports}${bearArgs}` },
  ]

  const resp = await invokeLLM(deepModel, messages, apiKey, baseUrl)
  const bullResponse = resp.content

  return {
    investmentDebateState: {
      ...debateState,
      bullHistory: bullResponse,
      currentResponse: 'Bull',
      count: debateState.count + 1,
    },
  }
}
