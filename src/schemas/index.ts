/**
 * 结构化输出类型 — 对应 Python 版 schemas.py
 */

/** 投资组合评级 */
export type PortfolioRating = 'Buy' | 'Overweight' | 'Hold' | 'Underweight' | 'Sell'

/** 交易者动作 */
export type TraderAction = 'Buy' | 'Hold' | 'Sell'

/** 研究计划（Research Manager 输出） */
export interface ResearchPlan {
  recommendation: PortfolioRating
  rationale: string
  strategicActions: string
}

/** 渲染研究计划为 Markdown */
export function renderResearchPlan(plan: ResearchPlan): string {
  return [
    `**建议评级**: ${plan.recommendation}`,
    '',
    `**理由**: ${plan.rationale}`,
    '',
    `**策略行动**: ${plan.strategicActions}`,
  ].join('\n')
}

/** 交易者方案（Trader 输出） */
export interface TraderProposal {
  action: TraderAction
  reasoning: string
  entryPrice?: number
  stopLoss?: number
  positionSizing?: string
}

/** 渲染交易方案为 Markdown */
export function renderTraderProposal(proposal: TraderProposal): string {
  const parts = [
    `**操作**: ${proposal.action}`,
    '',
    `**理由**: ${proposal.reasoning}`,
  ]
  if (proposal.entryPrice !== undefined) {
    parts.push('', `**入场价**: ${proposal.entryPrice}`)
  }
  if (proposal.stopLoss !== undefined) {
    parts.push('', `**止损价**: ${proposal.stopLoss}`)
  }
  if (proposal.positionSizing) {
    parts.push('', `**仓位**: ${proposal.positionSizing}`)
  }
  parts.push('', `最终交易方案: **${proposal.action.toUpperCase()}**`)
  return parts.join('\n')
}

/** 投资组合决策（Portfolio Manager 输出） */
export interface PortfolioDecision {
  rating: PortfolioRating
  executiveSummary: string
  investmentThesis: string
  priceTarget?: number
  timeHorizon?: string
}

/** 渲染 Portfolio Decision 为 Markdown */
export function renderPortfolioDecision(decision: PortfolioDecision): string {
  const parts = [
    `**评级**: ${decision.rating}`,
    '',
    `**执行摘要**: ${decision.executiveSummary}`,
    '',
    `**投资论点**: ${decision.investmentThesis}`,
  ]
  if (decision.priceTarget !== undefined) {
    parts.push('', `**目标价**: ${decision.priceTarget}`)
  }
  if (decision.timeHorizon) {
    parts.push('', `**时间周期**: ${decision.timeHorizon}`)
  }
  return parts.join('\n')
}

/** 从文本中解析评级（对应 rating.py） */
export function parseRating(text: string): string {
  const match = text.match(/\*\*评级\*\*:\s*(Buy|Overweight|Hold|Underweight|Sell)/)
  if (match) return match[1]
  const matchEn = text.match(/\*\*Rating\*\*:\s*(Buy|Overweight|Hold|Underweight|Sell)/)
  if (matchEn) return matchEn[1]
  return 'Hold'
}
