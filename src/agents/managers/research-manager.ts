/**
 * 研究主管（Research Manager）— 对应 Python 版 research_manager.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { buildInstrumentContext, getLanguageInstruction } from '../utils'
import { renderResearchPlan, type ResearchPlan } from '../../schemas'

const SYSTEM_PROMPT = `你作为研究主管和辩论主持人，你的职责是批判性地评估本轮辩论，并为交易员提供清晰、可执行的行动计划。

评级标准（选其一）：
- Buy: 强烈看多，建议建仓或加仓
- Overweight: 看多，建议逐步增加仓位
- Hold: 中性，建议维持当前仓位
- Underweight: 看空，建议逐步减仓
- Sell: 强烈看空，建议清仓

注：这是 A 股标的。评估时需考虑政策影响、资金动向和解禁风险。

请以 JSON 格式输出，字段: recommendation, rationale, strategicActions` + getLanguageInstruction()

export async function researchManagerNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  deepModel: string,
): Promise<Partial<AgentState>> {
  const instrumentContext = buildInstrumentContext(state.companyOfInterest)
  const debateState = state.investmentDebateState
  const history = debateState.history || ''

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\n${instrumentContext}\n\n交易日期: ${state.tradeDate}`,
    },
    {
      role: 'user',
      content: `请根据以下辩论历史做出投资决策:\n\n${history}\n\n多方观点:\n${debateState.bullHistory}\n\n空方观点:\n${debateState.bearHistory}`,
    },
  ]

  const resp = await invokeLLM(deepModel, messages, apiKey, baseUrl, {
    responseSchema: {
      type: 'object',
      properties: {
        recommendation: { type: 'string', enum: ['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell'] },
        rationale: { type: 'string' },
        strategicActions: { type: 'string' },
      },
      required: ['recommendation', 'rationale', 'strategicActions'],
    },
  })

  let plan: ResearchPlan
  try {
    plan = JSON.parse(resp.content)
  } catch {
    // 回退：纯文本输出
    return {
      investmentPlan: resp.content,
      investmentDebateState: {
        ...debateState,
        judgeDecision: resp.content,
      },
    }
  }

  const markdown = renderResearchPlan(plan as ResearchPlan)
  return {
    investmentPlan: markdown,
    investmentDebateState: {
      ...debateState,
      judgeDecision: markdown,
      currentResponse: markdown,
    },
  }
}
