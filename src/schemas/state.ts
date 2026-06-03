/**
 * Agent 状态类型 — 对应 Python 版 agent_states.py
 */

/** 投资辩论状态 */
export interface InvestDebateState {
  bullHistory: string
  bearHistory: string
  history: string
  currentResponse: string
  judgeDecision: string
  count: number
}

/** 风险辩论状态 */
export interface RiskDebateState {
  aggressiveHistory: string
  conservativeHistory: string
  neutralHistory: string
  history: string
  latestSpeaker: string
  currentAggressiveResponse: string
  currentConservativeResponse: string
  currentNeutralResponse: string
  judgeDecision: string
  count: number
}

/** Agent 运行状态 */
export interface AgentState {
  messages: Message[]
  companyOfInterest: string
  tradeDate: string
  sender: string
  marketReport: string
  sentimentReport: string
  newsReport: string
  fundamentalsReport: string
  policyReport: string
  hotMoneyReport: string
  lockupReport: string
  dataQualitySummary: string
  investmentDebateState: InvestDebateState
  investmentPlan: string
  traderInvestmentPlan: string
  riskDebateState: RiskDebateState
  finalTradeDecision: string
  pastContext: string
}

/** 消息类型 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolCallId?: string
  name?: string
}

/** 工具调用 */
export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

/** 创建初始辩论状态 */
export function createInvestDebateState(): InvestDebateState {
  return {
    bullHistory: '',
    bearHistory: '',
    history: '',
    currentResponse: '',
    judgeDecision: '',
    count: 0,
  }
}

/** 创建初始风控状态 */
export function createRiskDebateState(): RiskDebateState {
  return {
    aggressiveHistory: '',
    conservativeHistory: '',
    neutralHistory: '',
    history: '',
    latestSpeaker: '',
    currentAggressiveResponse: '',
    currentConservativeResponse: '',
    currentNeutralResponse: '',
    judgeDecision: '',
    count: 0,
  }
}

/** 创建初始 Agent 状态 */
export function createInitialState(
  companyName: string,
  tradeDate: string,
  pastContext = ''
): AgentState {
  return {
    messages: [{ role: 'user', content: companyName }],
    companyOfInterest: companyName,
    tradeDate,
    sender: '',
    marketReport: '',
    sentimentReport: '',
    newsReport: '',
    fundamentalsReport: '',
    policyReport: '',
    hotMoneyReport: '',
    lockupReport: '',
    dataQualitySummary: '',
    investmentDebateState: createInvestDebateState(),
    investmentPlan: '',
    traderInvestmentPlan: '',
    riskDebateState: createRiskDebateState(),
    finalTradeDecision: '',
    pastContext,
  }
}
