/**
 * 数据库模块 — PostgreSQL 持久化分析任务和结果
 * 连接串: postgresql://zhenzhang:834ZXrspjldjd4xuHgjLAdo27JRzjCoE@127.0.0.1:5432/tradingagents
 */

import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://zhenzhang:834ZXrspjldjd4xuHgjLAdo27JRzjCoE@127.0.0.1:5432/tradingagents',
  max: 5,
  idleTimeoutMillis: 30000,
})

export interface TaskRecord {
  id: string
  ticker: string
  ticker_name: string
  trade_date: string
  status: 'pending' | 'running' | 'done' | 'error' | 'recycled'
  progress_json: string
  signal: string
  report: string
  error_message: string
  created_at: string
  updated_at: string
}

export interface TaskProgress {
  stages?: Record<string, { status: string }>
  messages?: any[]
}

/** 生成任务ID */
export function genTaskId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 创建新任务 */
export async function createTask(
  id: string,
  ticker: string,
  tickerName: string,
  tradeDate: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO analysis_tasks (id, ticker, ticker_name, trade_date, status, progress_json)
     VALUES ($1, $2, $3, $4, 'running', '{}')`,
    [id, ticker, tickerName, tradeDate],
  )
}

/** 更新任务进度 */
export async function updateProgress(id: string, progress: TaskProgress): Promise<void> {
  await pool.query(
    `UPDATE analysis_tasks SET progress_json = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(progress), id],
  )
}

/** 标记任务完成 */
export async function completeTask(
  id: string,
  signal: string,
  report: string,
  ticker: string,
  tradeDate: string,
): Promise<void> {
  await pool.query(
    `UPDATE analysis_tasks
     SET status = 'done', signal = $2, report = $3, progress_json = $4, updated_at = NOW()
     WHERE id = $1`,
    [id, signal, report, '{}'],
  )
}

/** 标记任务错误 */
export async function failTask(id: string, errorMessage: string): Promise<void> {
  await pool.query(
    `UPDATE analysis_tasks SET status = 'error', error_message = $2, updated_at = NOW() WHERE id = $1`,
    [id, errorMessage],
  )
}

/** 获取任务状态 */
export async function getTask(id: string): Promise<TaskRecord | null> {
  const r = await pool.query('SELECT * FROM analysis_tasks WHERE id = $1', [id])
  return r.rows[0] || null
}

/** 查找缓存（3天内同一 ticker 同一日期已完成的任务） */
export async function findCached(
  ticker: string,
  tradeDate: string,
): Promise<TaskRecord | null> {
  const r = await pool.query(
    `SELECT * FROM analysis_tasks
     WHERE ticker = $1 AND trade_date = $2 AND status = 'done'
       AND created_at > NOW() - INTERVAL '3 days'
     ORDER BY created_at DESC LIMIT 1`,
    [ticker, tradeDate],
  )
  return r.rows[0] || null
}

/** 获取历史记录（最近50条已完成任务） */
export async function getHistory(limit = 50): Promise<TaskRecord[]> {
  const r = await pool.query(
    `SELECT id, ticker, ticker_name, trade_date, status, signal, created_at
     FROM analysis_tasks
     WHERE status = 'done' OR status = 'recycled'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  )
  return r.rows
}

/** 清理7天前的数据 */

/** 强制清理所有测试/失败/过期数据 */
export async function forceCleanup(): Promise<void> {
  // 删除所有非 done 状态的任务（测试残留）
  await pool.query("DELETE FROM analysis_tasks WHERE status != 'done' AND created_at < NOW() - INTERVAL '1 hour'");
  // 删除7天前的所有记录
  await pool.query("DELETE FROM analysis_tasks WHERE created_at < NOW() - INTERVAL '7 days'");
  // 标记7天前到3天前的为回收
  await pool.query(
    "UPDATE analysis_tasks SET status = 'recycled' WHERE status = 'done' AND created_at < NOW() - INTERVAL '3 days'",
  );
}

export async function cleanOldTasks(): Promise<void> {
  // 7天前已完成任务 → 标记回收
  await pool.query(
    `UPDATE analysis_tasks SET status = 'recycled'
     WHERE status = 'done' AND created_at < NOW() - INTERVAL '3 days'`,
  )
  // 10天前 → 彻底删除
  await pool.query(
    `DELETE FROM analysis_tasks WHERE created_at < NOW() - INTERVAL '5 days'`,
  )
}




