/**
 * Pipeline 编排 — 核心状态机
 *
 * 纯 async/await 线性编排，不依赖 LangGraph
 * 支持断点续跑与交易反思
 */

import type { AgentState } from '../schemas/state'
import { createInitialState } from '../schemas/state'
import { parseRating } from '../schemas'

// 导入所有 Agent 节点
import { marketAnalystNode } from '../agents/analysts/market'
import { socialMediaAnalystNode } from '../agents/analysts/social-media'
import { newsAnalystNode } from '../agents/analysts/news'
import { fundamentalsAnalystNode } from '../agents/analysts/fundamentals'
import { policyAnalystNode } from '../agents/analysts/policy'
import { hotMoneyAnalystNode } from '../agents/analysts/hot-money'
import { lockupAnalystNode } from '../agents/analysts/lockup'
import { qualityGateNode } from '../agents/quality-gate'
import { bullResearcherNode } from '../agents/researchers/bull'
import { bearResearcherNode } from '../agents/researchers/bear'
import { researchManagerNode } from '../agents/managers/research-manager'
import { traderNode } from '../agents/trader'
import { aggressiveDebatorNode } from '../agents/risk/aggressive'
import { conservativeDebatorNode } from '../agents/risk/conservative'
import { neutralDebatorNode } from '../agents/risk/neutral'
import { portfolioManagerNode } from '../agents/managers/portfolio-manager'

// 断点续跑 & 反思
import { saveCheckpoint, loadLatestCheckpoint, restoreStateFromCheckpoint, logTradeMemory, buildMemoryContext } from './checkpointer'
import { buildReflectionContext } from './reflection'

export interface PipelineConfig {
  apiKey: string
  baseUrl: string
  quickModel: string
  deepModel: string
  analysts: string[]
  maxDebateRounds: number
  enableCheckpoint?: boolean  // 是否启用断点续跑
  enableReflection?: boolean  // 是否启用交易反思
  continuePrevious?: boolean  // 是否尝试恢复之前的分析
  memoryContext?: string      // 外部传入历史上下文
}

export type StageCallback = (stage: string, data: any) => void

/**
 * 运行完整的 Agent 投研流程
 */
export async function runPipeline(
  ticker: string,
  tradeDate: string,
  config: PipelineConfig,
  onStage?: StageCallback,
): Promise<{ finalState: Partial<AgentState>; signal: string }> {
  // 检查断点续跑
  if (config.continuePrevious && config.enableCheckpoint !== false) {
    const cp = loadLatestCheckpoint(ticker, tradeDate)
    if (cp) {
      onStage?.('restore', { checkpointId: cp.id, stage: cp.stage })
      let state = restoreStateFromCheckpoint(cp)
      const result = await resumePipeline(state, cp.stage, config, onStage)
      return result
    }
  }

  return runFreshPipeline(ticker, tradeDate, config, onStage)
}

/**
 * 从头运行流水线
 */
async function runFreshPipeline(
  ticker: string,
  tradeDate: string,
  config: PipelineConfig,
  onStage?: StageCallback,
): Promise<{ finalState: Partial<AgentState>; signal: string }> {
  let state = createInitialState(ticker, tradeDate)

  // 注入历史上下文
  if (config.enableReflection !== false) {
    const memoryCtx = buildMemoryContext(5)
    if (memoryCtx) {
      state.pastContext = memoryCtx
      state.messages.push({ role: 'system', content: 'Recent trade context:\n' + memoryCtx })
    }
  }

  // 外部传入的历史上下文
  if (config.memoryContext) {
    state.pastContext = config.memoryContext
  }

  // 分析师按顺序运行
  const analystOrder = ['market', 'social', 'news', 'fundamentals', 'policy', 'hot_money', 'lockup']
  const analystMap: Record<string, (s: AgentState) => Promise<Partial<AgentState>>> = {
    market: (s) => marketAnalystNode(s, config.apiKey, config.baseUrl, config.quickModel),
    social: (s) => socialMediaAnalystNode(s, config.apiKey, config.baseUrl, config.quickModel),
    news: (s) => newsAnalystNode(s, config.apiKey, config.baseUrl, config.quickModel),
    fundamentals: (s) => fundamentalsAnalystNode(s, config.apiKey, config.baseUrl, config.quickModel),
    policy: (s) => policyAnalystNode(s, config.apiKey, config.baseUrl, config.quickModel),
    hot_money: (s) => hotMoneyAnalystNode(s, config.apiKey, config.baseUrl, config.quickModel),
    lockup: (s) => lockupAnalystNode(s, config.apiKey, config.baseUrl, config.quickModel),
  }

  // 1. 并行运行选中的分析师（互不依赖，各写不同字段）
  const analystPromises = analystOrder
    .filter(at => config.analysts.includes(at))
    .map(async (analystType) => {
      onStage?.('analyst', { type: analystType, status: 'running' })
      let update: Partial<AgentState> = {}
      try {
        update = await analystMap[analystType](state)
      } catch (e: any) {
        onStage?.('analyst', { type: analystType, status: 'error' })
        return { analystType, update }
      }
      onStage?.('analyst', { type: analystType, status: 'done' })
      return { analystType, update }
    })
  const analystResults = await Promise.all(analystPromises)
  for (const { analystType, update } of analystResults) {
    state = { ...state, ...update }
    const reportKey = analystType + 'Report'
    const reportContent = (update as any)[reportKey]
    if (reportContent) {
      onStage?.('agent_report', { agent: analystType, content: reportContent })
    }
  }

  // 保存检查点
  if (config.enableCheckpoint !== false) {
    await saveCheckpoint(ticker, tradeDate, 'analysts', state)
    onStage?.('checkpoint', { stage: 'analysts' })
  }

  // 2. 质量门控
  onStage?.('quality_gate', { status: 'running' })
  const qgUpdate = await qualityGateNode(state, config.apiKey, config.baseUrl, config.quickModel)
  state = { ...state, ...qgUpdate }
  if (qgUpdate.dataQualitySummary) {
    onStage?.('agent_report', { agent: 'quality_gate', content: qgUpdate.dataQualitySummary })
  }
  onStage?.('quality_gate', { status: 'done' })

  if (config.enableCheckpoint !== false) {
    await saveCheckpoint(ticker, tradeDate, 'quality_gate', state)
  }

  // 3. 多空辩论
  onStage?.('debate', { status: 'running' })
  const maxRounds = config.maxDebateRounds
  let debateCount = 0
  while (debateCount < maxRounds * 2) {
    const bullUpdate = await bullResearcherNode(state, config.apiKey, config.baseUrl, config.deepModel)
    state = { ...state, investmentDebateState: bullUpdate.investmentDebateState! }
    if (bullUpdate.investmentDebateState?.currentResponse) {
      onStage?.('debate_message', { side: 'bull', round: Math.ceil(debateCount/2)+1, content: bullUpdate.investmentDebateState.currentResponse })
    }
    debateCount++

    const bearUpdate = await bearResearcherNode(state, config.apiKey, config.baseUrl, config.deepModel)
    state = { ...state, investmentDebateState: bearUpdate.investmentDebateState! }
    if (bearUpdate.investmentDebateState?.currentResponse) {
      onStage?.('debate_message', { side: 'bear', round: Math.ceil(debateCount/2)+1, content: bearUpdate.investmentDebateState.currentResponse })
    }
    debateCount++
  }
  onStage?.('debate', { status: 'done' })

  if (config.enableCheckpoint !== false) {
    await saveCheckpoint(ticker, tradeDate, 'debate', state)
  }

  // 4. 研究主管
  onStage?.('research_manager', { status: 'running' })
  const rmUpdate = await researchManagerNode(state, config.apiKey, config.baseUrl, config.deepModel)
  state = { ...state, ...rmUpdate }
  if (rmUpdate.investmentPlan) {
    onStage?.('agent_report', { agent: 'research_manager', content: rmUpdate.investmentPlan })
  }
  onStage?.('research_manager', { status: 'done' })

  if (config.enableCheckpoint !== false) {
    await saveCheckpoint(ticker, tradeDate, 'research_manager', state)
  }

  // 5. Trader
  onStage?.('trader', { status: 'running' })
  const traderUpdate = await traderNode(state, config.apiKey, config.baseUrl, config.quickModel)
  state = { ...state, ...traderUpdate }
  if (traderUpdate.traderInvestmentPlan) {
    onStage?.('agent_report', { agent: 'trader', content: traderUpdate.traderInvestmentPlan })
  }
  onStage?.('trader', { status: 'done' })

  if (config.enableCheckpoint !== false) {
    await saveCheckpoint(ticker, tradeDate, 'trader', state)
  }

  // 6. 风控辩论
  onStage?.('risk', { status: 'running' })
  let riskCount = 0
  while (riskCount < maxRounds * 3) {
    const aggUpdate = await aggressiveDebatorNode(state, config.apiKey, config.baseUrl, config.quickModel)
    state = { ...state, riskDebateState: aggUpdate.riskDebateState! }
    if (aggUpdate.riskDebateState?.currentAggressiveResponse) {
      onStage?.('risk_message', { side: 'aggressive', round: riskCount+1, content: aggUpdate.riskDebateState.currentAggressiveResponse })
    }
    riskCount++

    const conUpdate = await conservativeDebatorNode(state, config.apiKey, config.baseUrl, config.quickModel)
    state = { ...state, riskDebateState: conUpdate.riskDebateState! }
    if (conUpdate.riskDebateState?.currentConservativeResponse) {
      onStage?.('risk_message', { side: 'conservative', round: riskCount+1, content: conUpdate.riskDebateState.currentConservativeResponse })
    }
    riskCount++

    const neuUpdate = await neutralDebatorNode(state, config.apiKey, config.baseUrl, config.quickModel)
    state = { ...state, riskDebateState: neuUpdate.riskDebateState! }
    if (neuUpdate.riskDebateState?.currentNeutralResponse) {
      onStage?.('risk_message', { side: 'neutral', round: riskCount+1, content: neuUpdate.riskDebateState.currentNeutralResponse })
    }
    riskCount++
  }
  onStage?.('risk', { status: 'done' })

  if (config.enableCheckpoint !== false) {
    await saveCheckpoint(ticker, tradeDate, 'risk', state)
  }

  // 7. 投资组合主管
  onStage?.('pm', { status: 'running' })
  const pmUpdate = await portfolioManagerNode(state, config.apiKey, config.baseUrl, config.deepModel)
  state = { ...state, ...pmUpdate }
  if (pmUpdate.finalTradeDecision) {
    onStage?.('agent_report', { agent: 'pm', content: pmUpdate.finalTradeDecision })
  }
  onStage?.('pm', { status: 'done' })

  const signal = parseRating(state.finalTradeDecision)

  // 记录交易记忆
  if (config.enableCheckpoint !== false) {
    await logTradeMemory({
      ticker,
      tradeDate,
      signal,
      confidence: signal === 'Buy' || signal === 'Sell' ? 0.8 : 0.5,
      reasoning: state.finalTradeDecision?.slice(0, 200) || '',
      timestamp: Date.now(),
      modelUsed: config.deepModel,
    })
  }

  onStage?.('complete', { signal })

  return { finalState: state, signal }
}

/**
 * 从检查点恢复运行
 */
async function resumePipeline(
  state: AgentState,
  resumeStage: string,
  config: PipelineConfig,
  onStage?: StageCallback,
): Promise<{ finalState: Partial<AgentState>; signal: string }> {
  onStage?.('resuming', { stage: resumeStage })
  return runFreshPipeline(state.companyOfInterest, state.tradeDate, config, onStage)
}
