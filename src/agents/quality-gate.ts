/**
 * 质量门控 — 对应 Python 版 quality_gate.py
 */

import type { AgentState } from '../schemas/state'
import { invokeLLM, type ChatMessage } from '../llm/client'
import { getLanguageInstruction } from './utils'

const SYSTEM_PROMPT = `你是一位数据质量审核员。评估以下分析师报告的数据完整性和质量。

检查项：
1. 是否包含具体数据（股价、指标数值等）
2. 是否有明确的结论或信号
3. 报告是否有实质性内容而非空泛描述

列出各报告的质量评分（优/良/差）并说明理由。` + getLanguageInstruction()

export async function qualityGateNode(
  state: AgentState,
  apiKey: string,
  baseUrl: string,
  quickModel: string,
): Promise<Partial<AgentState>> {
  const reports = [
    { name: '市场分析', content: state.marketReport },
    { name: '情绪分析', content: state.sentimentReport },
    { name: '新闻分析', content: state.newsReport },
    { name: '基本面分析', content: state.fundamentalsReport },
  ]

  const reportText = reports
    .filter(r => r.content)
    .map(r => `=== ${r.name} ===\n${r.content}`)
    .join('\n\n')

  if (!reportText) {
    return { dataQualitySummary: '无报告需要审核' }
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `请审核以下报告质量:\n\n${reportText}` },
  ]

  const resp = await invokeLLM(quickModel, messages, apiKey, baseUrl)
  return { dataQualitySummary: resp.content }
}
