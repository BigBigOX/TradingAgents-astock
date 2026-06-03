/**
 * Agent 工具函数 — 对应 Python 版 agent_utils.py
 */

import type { AgentState } from '../schemas/state'

/** 获取语言指令 */
export function getLanguageInstruction(): string {
  return ' 请用中文撰写你的分析报告。'
}

/** 构建标的说明 */
export function buildInstrumentContext(ticker: string): string {
  return `分析的标的是 \`${ticker}\`。在每次工具调用和报告中都使用此代码。`
}

/** 创建消息清理函数 */
export function createMsgDelete() {
  return (state: AgentState): Partial<AgentState> => {
    return {
      messages: [{ role: 'user' as const, content: '继续' }],
    }
  }
}
