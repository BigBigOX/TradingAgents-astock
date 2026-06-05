/**
 * 历史记录 API — 从 PostgreSQL 读取/删除分析历史
 * GET  /api/history      — 获取历史列表
 * DELETE /api/history?id=xxx — 手动删除（移入回收站）
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getHistory, deleteTask } from '../../src/data/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const limit = parseInt(String(req.query.limit || '50'), 10)
    const history = await getHistory(limit)

    res.status(200).json({
      history: history.map(h => ({
        status: h.status,
        id: h.id,
        ticker: h.ticker,
        tickerName: h.ticker_name,
        tradeDate: h.trade_date,
        signal: h.signal,
        createdAt: h.created_at,
      })),
    })
    return
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string
    if (!id) return res.status(400).json({ error: '缺少 id 参数' })
    await deleteTask(id)
    res.status(200).json({ success: true })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
