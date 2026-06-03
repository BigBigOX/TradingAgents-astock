/**
 * 投资组合主管（Portfolio Manager）— 对应 Python 版 portfolio_manager.py
 */

import type { AgentState } from '../../schemas/state'
import { invokeLLM, type ChatMessage } from '../../llm/client'
import { buildInstrumentContext, getLanguageInstruction } from '../utils'
import { renderPortfolioDecision, type PortfolioDecision } from '../../schemas'

const SYSTEM_PROMPT = `你作为投资组合主管，负责根据分析师辩论做出最终投资决策。

评级标准（选其一）：
- Buy: 强烈看多，建议建仓
- Overweight: 看多，建议增仓
- Hold: 中性，建议维持
- Underweight: 看空，建议减仓
- Sell: 强烈看空，建议清仓

请以 JSON 格式输出，字段: rating, executiveSummary, investmentThesis, priceTarget(可选), timeHorizon(可选)` + getLanguageInstruction()

export async function portfolioManagerNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  deepModel: string,
): Promise<Partial<AgentState>> {
  const instrumentContext = buildInstrumentContext(state.companyOfInterest)
  const riskState = state.riskDebateState

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\n${instrumentContext}\n\n交易日期: ${state.tradeDate}`,
    },
    {
      role: 'user',
      content: [
        `交易员方案:\n${state.traderInvestmentPlan}`,
        `\n\n风险辩论:` +
        `\n激进方:\n${riskState.aggressiveHistory}` +
        `\n保守方:\n${riskState.conservativeHistory}` +
        `\n中性方:\n${riskState.neutralHistory}` +
        `\n\n请做出最终投资决策。`,
      ].join('\n'),
    },
  ]

  const resp = await invokeLLM(deepModel, messages, apiKey, baseUrl, {
    responseSchema: {
      type: 'object',
      properties: {
        rating: { type: 'string', enum: ['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell'] },
        executiveSummary: { type: 'string' },
        investmentThesis: { type: 'string' },
        priceTarget: { type: 'number' },
        timeHorizon: { type: 'string' },
      },
      required: ['rating', 'executiveSummary', 'investmentThesis'],
    },
  })

  try {
    const decision = JSON.parse(resp.content) as PortfolioDecision
    const markdown = renderPortfolioDecision(decision)
    return {
      finalTradeDecision: markdown,
      riskDebateState: {
        ...riskState,
        judgeDecision: markdown,
      },
    }
  } catch {
    return {
      finalTradeDecision: resp.content,
      riskDebateState: {
        ...riskState,
        judgeDecision: resp.content,
      },
    }
  }
}
