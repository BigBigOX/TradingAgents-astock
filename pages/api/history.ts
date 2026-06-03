/**
 * 历史记录 API — 从 PostgreSQL 读取分析历史
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getHistory } from '../../src/data/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const limit = parseInt(String(req.query.limit || '50'), 10)
  const history = await getHistory(limit)

  res.status(200).json({
    history: history.map(h => ({
      id: h.id,
      ticker: h.ticker,
      tickerName: h.ticker_name,
      tradeDate: h.trade_date,
      signal: h.signal,
      createdAt: h.created_at,
    })),
  })
}
