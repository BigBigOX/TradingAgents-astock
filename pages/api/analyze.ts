/**
 * POST /api/analyze - 启动后台分析任务，持久化到 PostgreSQL
 * GET  /api/analyze?id=xxx - 轮询获取任务状态
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { loadConfig } from '../../src/data/config'
import { resolveTicker } from '../../src/data/utils'
import { runPipeline } from '../../src/pipeline'
import {
  genTaskId, createTask, updateProgress, completeTask, failTask,
  getTask, findCached, cleanOldTasks,
} from '../../src/data/db'

export const config = { api: { bodyParser: true } }

// 内存进度缓存：taskId -> progress
const progressCache: Record<string, any> = {}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = req.query || {}
  const taskId = query.id as string | undefined

  // GET 轮询任务状态
  if (req.method === 'GET' && taskId) {
    // 先查内存
    if (progressCache[taskId]) {
      res.status(200).json(progressCache[taskId])
      return
    }
    // 再查数据库
    const t = await getTask(taskId)
    if (!t) { res.status(404).json({ error: '任务不存在' }); return }
    const result = {
      status: t.status,
      progress: t.progress_json ? JSON.parse(t.progress_json) : {},
      signal: t.signal || null,
      report: t.report || '',
      error: t.error_message || null,
      done: t.status === 'done',
      ticker: t.ticker,
      tradeDate: t.trade_date,
    }
    res.status(200).json(result)
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: '仅支持 POST' })
    return
  }

  const { ticker: raw, date: tradeDate } = req.body
  if (!raw || !tradeDate) {
    res.status(400).json({ error: '缺少参数' })
    return
  }

  let ticker: string
  try { ticker = await resolveTicker(raw) } catch (e: any) {
    res.status(400).json({ error: e.message })
    return
  }

  const cfg = loadConfig()
  if (!cfg.apiKey) {
    res.status(400).json({ error: '未配置 API Key' })
    return
  }

  // 检查数据库缓存（3天内）
  const cached = await findCached(ticker, tradeDate)
  if (cached) {
    res.status(200).json({
      taskId: null, cached: true,
      signal: cached.signal || null,
      report: cached.report || '',
      progress: cached.progress_json ? JSON.parse(cached.progress_json) : {},
      status: 'done', done: true,
      ticker, tradeDate,
    })
    return
  }

  const id = genTaskId()

  // 初始化内存进度
  const progress: any = {
    status: 'running', stages: {}, messages: [],
    signal: null, report: '', error: null, done: false,
    ticker, tradeDate,
  }
  progressCache[id] = progress

  await createTask(id, ticker, raw === ticker ? '' : raw, tradeDate)

  let dbDirty = false
  let dbTimer: any = null

  const scheduleDbSave = () => {
    if (dbDirty) return
    dbDirty = true
    dbTimer = setTimeout(() => {
      dbDirty = false
      updateProgress(id, { stages: progress.stages, messages: progress.messages }).catch(() => {})
    }, 2000)
  }

  // 后台异步分析
  runPipeline(ticker, tradeDate, {
    apiKey: cfg.apiKey, baseUrl: cfg.baseUrl,
    quickModel: cfg.quickModel, deepModel: cfg.deepModel,
    analysts: cfg.analysts, maxDebateRounds: cfg.maxDebateRounds,
  }, (stage: string, data: any) => {
    if (stage === 'analyst' && data.type) {
      progress.stages[data.type] = { status: data.status }
      if (data.status === 'done') scheduleDbSave()
      return
    }
    if (stage === 'agent_report') {
      progress.messages.push({ id: data.agent + '_' + Date.now(), agent: data.agent, content: data.content })
      progress.stages[data.agent] = { status: 'done' }
      scheduleDbSave()
      return
    }
    if (stage === 'debate_message') {
      progress.messages.push({ id: 'debate_' + data.side + '_' + data.round, agent: 'debate', side: data.side, content: data.content, round: data.round })
      scheduleDbSave()
      return
    }
    if (stage === 'risk_message') {
      progress.messages.push({ id: 'risk_' + data.side + '_' + data.round, agent: 'risk', side: data.side, content: data.content, round: data.round })
      scheduleDbSave()
      return
    }
    if (data.status === 'running' || data.status === 'done') {
      progress.stages[stage] = { status: data.status }
      if (data.status === 'done') scheduleDbSave()
    }
  }).then(async ({ finalState, signal }: any) => {
    if (dbTimer) clearTimeout(dbTimer)
    const parts: string[] = []
    if (finalState.marketReport) parts.push('## 市场分析\n\n' + finalState.marketReport)
    if (finalState.sentimentReport) parts.push('## 情绪分析\n\n' + finalState.sentimentReport)
    if (finalState.newsReport) parts.push('## 新闻分析\n\n' + finalState.newsReport)
    if (finalState.fundamentalsReport) parts.push('## 基本面分析\n\n' + finalState.fundamentalsReport)
    if (finalState.policyReport) parts.push('## 政策分析\n\n' + finalState.policyReport)
    if (finalState.hotMoneyReport) parts.push('## 资金分析\n\n' + finalState.hotMoneyReport)
    if (finalState.lockupReport) parts.push('## 解禁分析\n\n' + finalState.lockupReport)
    if (finalState.finalTradeDecision) parts.push('## 最终决策\n\n' + finalState.finalTradeDecision)
    const report = parts.join('\n\n---\n\n')
    progress.status = 'done'; progress.done = true; progress.signal = { text: signal }; progress.report = report
    delete progressCache[id]
    await completeTask(id, signal, report, ticker, tradeDate)
    cleanOldTasks().catch(() => {})
  }).catch(async (e: any) => {
    progress.status = 'error'; progress.error = e.message
    delete progressCache[id]
    await failTask(id, e.message)
  })

  res.status(200).json({ taskId: id, cached: false, ticker, tradeDate })
}
