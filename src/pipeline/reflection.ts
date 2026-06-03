/**
 * 交易反思与回测基准 — 对应 Python graph/reflection.py
 */
import { loadRecentMemory } from './checkpointer';

export interface ReflectionResult {
  totalTrades: number;
  winRate: number;
  avgConfidence: number;
  recentPerformance: string;
  suggestedImprovements: string[];
}

async function getCSI300Quote(): Promise<{ price: number; changePct: number; pe: number; pb: number }> {
  try {
    const resp = await fetch('https://qt.gtimg.cn/q=sh000300', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const raw = await resp.text();
    const m = raw.match(/"([^"]+)"/);
    if (m) { const p = m[1].split('~'); return { price: parseFloat(p[3] || '0'), changePct: parseFloat(p[32] || '0'), pe: parseFloat(p[39] || '0'), pb: parseFloat(p[40] || '0') }; }
  } catch { }
  return { price: 0, changePct: 0, pe: 0, pb: 0 };
}

export async function analyzePerformance(n = 10): Promise<ReflectionResult> {
  const memories = loadRecentMemory(n);
  const csi300 = await getCSI300Quote();
  if (memories.length === 0) {
    return { totalTrades: 0, winRate: 0, avgConfidence: 0, recentPerformance: 'No trade history yet.', suggestedImprovements: ['Run at least 5 analyses first.'] };
  }
  const total = memories.length;
  const bullish = memories.filter(m => m.signal === 'Buy' || m.signal === 'Overweight').length;
  const avgConf = memories.reduce((s, m) => s + m.confidence, 0) / total;
  const s: string[] = [];
  if (bullish / total > 0.8) s.push('Bullish ratio >80%, increase debate rounds.');
  if (avgConf < 0.4) s.push('Low confidence, check data sources.');
  if (csi300.changePct > 0 && bullish / total < 0.3) s.push('Market up but bearish, possible over-caution.');
  if (csi300.changePct < -5) s.push('CSI 300 dropped >5%, consider risk alert.');
  const lines = ['## Reflection Report','','### Summary','- Analyses: ' + total,'- Bullish: ' + (bullish/total*100).toFixed(1) + '%','- Avg Confidence: ' + (avgConf*100).toFixed(1) + '%','- CSI 300: ' + csi300.price.toFixed(2) + ' (' + (csi300.changePct>0?'+':'') + csi300.changePct.toFixed(2) + '%)','','### Suggestions',...(s.length===0?['- No anomalies.']:s.map(x=>'- '+x))];
  return { totalTrades: total, winRate: bullish/total, avgConfidence: avgConf, recentPerformance: lines.join('\n'), suggestedImprovements: s };
}

export async function buildReflectionContext(): Promise<string> {
  return (await analyzePerformance(10)).recentPerformance;
}
