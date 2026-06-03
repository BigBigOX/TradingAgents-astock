/**
 * 历史记录 API — 读取检查点和记忆日志
 * 对应 Python web/history.py
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { NextApiRequest, NextApiResponse } from 'next';

const DB_DIR = path.join(os.homedir(), '.tradingagents', 'checkpoints');
const MEMORY_DIR = path.join(os.homedir(), '.tradingagents', 'memory');

export interface HistoryEntry { id: string; ticker: string; tradeDate: string; timestamp: number; stage: string; signal?: string; }

function extractSignal(content: string): string | undefined {
  const m = content.match(/"finalTradeDecision"\s*:\s*"([^"]+)"/);
  return m?.[1];
}

export function scanHistory(limit = 50): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  if (fs.existsSync(DB_DIR)) {
    try {
      const files = fs.readdirSync(DB_DIR).filter(f => f.endsWith('.json')).sort().reverse().slice(0, limit);
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(DB_DIR, file), 'utf-8');
          const cp = JSON.parse(raw);
          entries.push({ id: cp.id || file, ticker: cp.ticker || '', tradeDate: cp.tradeDate || '', timestamp: cp.timestamp || 0, stage: cp.stage || '', signal: extractSignal(JSON.stringify(cp.state || {})) });
        } catch { }
      }
    } catch { }
  }
  if (fs.existsSync(MEMORY_DIR)) {
    try {
      for (const file of fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.jsonl')).sort().reverse()) {
        for (const line of fs.readFileSync(path.join(MEMORY_DIR, file), 'utf-8').trim().split('\n').reverse()) {
          if (!line.trim()) continue;
          try { const m = JSON.parse(line); entries.push({ id: m.ticker + '_' + m.tradeDate + '_' + m.timestamp, ticker: m.ticker, tradeDate: m.tradeDate, timestamp: m.timestamp, stage: 'complete', signal: m.signal }); if (entries.length >= limit) break; } catch { }
        }
        if (entries.length >= limit) break;
      }
    } catch { }
  }
  const seen = new Set<string>();
  return entries.filter(e => { const k = e.ticker + '_' + e.tradeDate; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.status(200).json({ history: scanHistory(parseInt(String(req.query.limit || '50'), 10)) });
}
