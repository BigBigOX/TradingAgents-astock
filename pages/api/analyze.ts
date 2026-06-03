/**
 * POST /api/analyze — 启动分析流程，通过 SSE 流式推送进度
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { loadConfig } from '../../src/data/config'
import { resolveTicker } from '../../src/data/utils'
import { runPipeline } from '../../src/pipeline'

export const config = {
  api: {
    bodyParser: true,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST' })
  }

  const { ticker: rawTicker, date: tradeDate } = req.body
  if (!rawTicker || !tradeDate) {
    return res.status(400).json({ error: '缺少 ticker 或 date 参数' })
  }

  let ticker: string
  try {
    ticker = await resolveTicker(rawTicker)
  } catch (e: any) {
    return res.status(400).json({ error: e.message })
  }

  const config = loadConfig()
  if (!config.apiKey) {
    return res.status(400).json({ error: '未配置 API Key，请在设置页面配置后再试' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)
  }

  try {
    const { finalState, signal } = await runPipeline(
      ticker, tradeDate,
      {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        quickModel: config.quickModel,
        deepModel: config.deepModel,
        analysts: config.analysts,
        maxDebateRounds: config.maxDebateRounds,
      },
      (stage, data) => { sendEvent('stage', { stage, ...data }) },
    )

    sendEvent('complete', { decision: finalState.finalTradeDecision, signal })

    const reportParts = [
      finalState.marketReport && `## 市场分析\n\n${finalState.marketReport}`,
      finalState.sentimentReport && `## 情绪分析\n\n${finalState.sentimentReport}`,
      finalState.newsReport && `## 新闻分析\n\n${finalState.newsReport}`,
      finalState.fundamentalsReport && `## 基本面分析\n\n${finalState.fundamentalsReport}`,
      finalState.policyReport && `## 政策分析\n\n${finalState.policyReport}`,
      finalState.hotMoneyReport && `## 资金分析\n\n${finalState.hotMoneyReport}`,
      finalState.lockupReport && `## 解禁分析\n\n${finalState.lockupReport}`,
      finalState.finalTradeDecision && `## 最终决策\n\n${finalState.finalTradeDecision}`,
    ].filter(Boolean).join('\n\n---\n\n')

    sendEvent('report', { content: reportParts })
    sendEvent('done', {})

  } catch (e: any) {
    sendEvent('error', { message: e.message })
  }

  res.end()
}
