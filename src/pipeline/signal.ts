/**
 * 交易信号处理与合成 — 对应 Python graph/signal_processing.py
 */
import type { PortfolioRating, TraderAction } from '../schemas';

const RATING_SCORES: Record<string, number> = { 'Buy': 1.0, 'Overweight': 0.5, 'Hold': 0, 'Underweight': -0.5, 'Sell': -1.0 };
const ACTION_SCORES: Record<string, number> = { 'Buy': 1.0, 'Hold': 0, 'Sell': -1.0 };

export function ratingToScore(rating: string): number { return RATING_SCORES[rating] ?? 0; }
export function actionToScore(action: string): number { return ACTION_SCORES[action] ?? 0; }

export interface SignalComponents {
  marketScore: number; sentimentScore: number; newsScore: number; fundamentalsScore: number;
  policyScore: number; hotMoneyScore: number; lockupScore: number; bullBearScore: number; riskScore: number;
  weights?: SignalWeights;
}
export interface SignalWeights { analysts: number; debate: number; risk: number; trader: number; }
export interface SynthesizedSignal { score: number; rating: PortfolioRating; confidence: number; breakdown: string; }

const DEFAULT_WEIGHTS: SignalWeights = { analysts: 0.25, debate: 0.30, risk: 0.25, trader: 0.20 };

export function synthesizeSignal(components: SignalComponents, finalDecision?: string): SynthesizedSignal {
  const w = components.weights ?? DEFAULT_WEIGHTS;
  const analystScore = (components.marketScore + components.sentimentScore + components.newsScore
    + components.fundamentalsScore + components.policyScore + components.hotMoneyScore + components.lockupScore) / 7;
  let totalScore = analystScore * w.analysts + components.bullBearScore * w.debate + components.riskScore * w.risk;
  if (finalDecision) totalScore = totalScore * (1 - w.trader) + actionToScore(finalDecision) * w.trader;
  totalScore = Math.max(-1, Math.min(1, totalScore));
  const rating: PortfolioRating = totalScore >= 0.6 ? 'Buy' : totalScore >= 0.2 ? 'Overweight' : totalScore >= -0.2 ? 'Hold' : totalScore >= -0.6 ? 'Underweight' : 'Sell';
  const confidence = Math.abs(totalScore);
  const lines = ['### Signal Breakdown','','| Dim | Score | W |','|---|---|---|','| Market | ' + components.marketScore.toFixed(2) + ' | ' + (w.analysts*100/7).toFixed(1)+'% |',
    '| Sentiment | ' + components.sentimentScore.toFixed(2) + ' | ' + (w.analysts*100/7).toFixed(1)+'% |',
    '| News | ' + components.newsScore.toFixed(2) + ' | ' + (w.analysts*100/7).toFixed(1)+'% |',
    '| Fund. | ' + components.fundamentalsScore.toFixed(2) + ' | ' + (w.analysts*100/7).toFixed(1)+'% |',
    '| Policy | ' + components.policyScore.toFixed(2) + ' | ' + (w.analysts*100/7).toFixed(1)+'% |',
    '| Hot $ | ' + components.hotMoneyScore.toFixed(2) + ' | ' + (w.analysts*100/7).toFixed(1)+'% |',
    '| Lockup | ' + components.lockupScore.toFixed(2) + ' | ' + (w.analysts*100/7).toFixed(1)+'% |',
    '| Debate | ' + components.bullBearScore.toFixed(2) + ' | ' + (w.debate*100).toFixed(1)+'% |',
    '| Risk | ' + components.riskScore.toFixed(2) + ' | ' + (w.risk*100).toFixed(1)+'% |',
    '','**Result**: ' + rating + ' (' + totalScore.toFixed(2) + ') | **Confidence**: ' + (confidence*100).toFixed(1)+'%'];
  return { score: totalScore, rating, confidence, breakdown: lines.join('\n') };
}

export function scoreToRating(score: number): PortfolioRating {
  if (score >= 0.6) return 'Buy'; if (score >= 0.2) return 'Overweight'; if (score >= -0.2) return 'Hold'; if (score >= -0.6) return 'Underweight'; return 'Sell';
}

export function parseSignalFromText(text: string): SynthesizedSignal {
  const patterns: [string, RegExp[]][] = [
    ['Buy', [/\bBuy\b/i, /\u4e70\u5165/]], ['Overweight', [/\bOverweight\b/i, /\u589e\u6301/i, /\u770b\u591a/i]],
    ['Hold', [/\bHold\b/i, /\u6301\u6709/i, /\u4e2d\u6027/i]], ['Underweight', [/\bUnderweight\b/i, /\u51cf\u6301/i, /\u770b\u7a7a/i]],
    ['Sell', [/\bSell\b/i, /\u5356\u51fa/i]],
  ];
  for (const [rating, regexps] of patterns) {
    for (const re of regexps) { if (re.test(text)) { const s = RATING_SCORES[rating] ?? 0; return { score: s, rating: rating as PortfolioRating, confidence: Math.abs(s), breakdown: 'Parsed from text.' }; } }
  }
  return { score: 0, rating: 'Hold', confidence: 0, breakdown: 'Fallback parse.' };
}
