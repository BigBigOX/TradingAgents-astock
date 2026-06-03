/**
 * 检查点与断点续跑 — JSON 持久化
 * 对应 Python 版 graph/checkpointer.py + agents/utils/memory.py
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { AgentState } from '../schemas/state';
import { createInitialState } from '../schemas/state';

const DB_DIR = path.join(os.homedir(), '.tradingagents', 'checkpoints');
const MEMORY_DIR = path.join(os.homedir(), '.tradingagents', 'memory');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export interface Checkpoint {
  id: string;
  ticker: string;
  tradeDate: string;
  timestamp: number;
  stage: string;
  state: Partial<AgentState>;
}

export async function saveCheckpoint(ticker: string, tradeDate: string, stage: string, state: Partial<AgentState>): Promise<string> {
  ensureDir(DB_DIR);
  const id = ticker + '_' + tradeDate + '_' + Date.now();
  const cp: Checkpoint = { id, ticker, tradeDate, timestamp: Date.now(), stage, state };
  fs.writeFileSync(path.join(DB_DIR, id + '.json'), JSON.stringify(cp, null, 2), 'utf-8');
  return id;
}

export function loadLatestCheckpoint(ticker: string, tradeDate: string): Checkpoint | null {
  ensureDir(DB_DIR);
  const prefix = ticker + '_' + tradeDate + '_';
  try {
    const files = fs.readdirSync(DB_DIR).filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort().reverse();
    if (files.length === 0) return null;
    return JSON.parse(fs.readFileSync(path.join(DB_DIR, files[0]), 'utf-8')) as Checkpoint;
  } catch { return null; }
}

export function restoreStateFromCheckpoint(cp: Checkpoint): AgentState {
  return { ...createInitialState(cp.ticker, cp.tradeDate), ...cp.state };
}

export function cleanOldCheckpoints(ticker: string, tradeDate: string, keep = 5): void {
  const _prefix = ticker + '_' + tradeDate + '_';
  const prefix = ticker + '_' + tradeDate + '_';
  ensureDir(DB_DIR);
  try {
    const files = fs.readdirSync(DB_DIR).filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort().reverse();
    for (let i = keep; i < files.length; i++) fs.unlinkSync(path.join(DB_DIR, files[i]));
  } catch { }
}

export interface TradeMemory {
  ticker: string;
  tradeDate: string;
  signal: string;
  confidence: number;
  reasoning: string;
  timestamp: number;
  modelUsed: string;
}

export async function logTradeMemory(memory: TradeMemory): Promise<void> {
  ensureDir(MEMORY_DIR);
  const dateStr = new Date().toISOString().slice(0, 10);
  fs.appendFileSync(path.join(MEMORY_DIR, dateStr + '.jsonl'), JSON.stringify(memory) + '\n', 'utf-8');
}

export function loadRecentMemory(n = 10): TradeMemory[] {
  ensureDir(MEMORY_DIR);
  const memories: TradeMemory[] = [];
  try {
    const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.jsonl')).sort().reverse();
    for (const file of files) {
      const content = fs.readFileSync(path.join(MEMORY_DIR, file), 'utf-8');
      const lines = content.trim().split('\n').reverse();
      for (const line of lines) {
        if (line.trim()) { try { memories.push(JSON.parse(line)); if (memories.length >= n) break; } catch { } }
      }
      if (memories.length >= n) break;
    }
  } catch { }
  return memories;
}

export function buildMemoryContext(n = 5): string {
  const recent = loadRecentMemory(n);
  if (recent.length === 0) return '';
  const parts = ['## Recent Trades'];
  for (const m of recent) {
    const date = new Date(m.timestamp).toISOString().slice(0, 10);
    parts.push('- [' + date + '] ' + m.ticker + ' -> ' + m.signal + ' (conf: ' + m.confidence + ')');
  }
  return parts.join('\n');
}

export function clearAllCheckpoints(): void {
  ensureDir(DB_DIR);
  try { const files = fs.readdirSync(DB_DIR).filter(f => f.endsWith('.json')); for (const f of files) fs.unlinkSync(path.join(DB_DIR, f)); } catch { }
}
