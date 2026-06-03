/**
 * POST /api/analyze — 启动分析流程，通过 SSE 流式推送进度
 *
 * 事件类型：
 *   stage          — 阶段状态更新（stage=market|social|... status=running|done）
 *   agent_report   — Agent 分析报告（agent=xxx, content=...）
 *   debate_message — 多空辩论消息（side=bull|bear, round=N, content=...）
 *   risk_message   — 风险评估消息（side=aggressive|conservative|neutral, round=N, content=...）
 *   complete       — 分析完成（signal, rating, decision）
 *   report         — 完整报告文本
 *   done           — 所有推送结束
 *   error          — 错误信息
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

function sendEvent(res: NextApiResponse, type: string, data: any) {
  const payload = JSON.stringify({ type, ...data });
  res.write('data: ' + payload + '\n\n');
  if (typeof (res as any).flush === 'function') (res as any).flush();
}

function createStageCallback(res: NextApiResponse) {
  return (stage: string, data: any) => {
    if (stage === 'analyst' && data.type) {
      sendEvent(res, 'stage', { stage: data.type, status: data.status });
      return;
    }
    if (stage === 'agent_report' || stage === 'debate_message' || stage === 'risk_message') {
      sendEvent(res, stage, data);
      return;
    }
    if (stage === 'complete') {
      sendEvent(res, 'complete', data);
      return;
    }
    if (data.status === 'running' || data.status === 'done') {
      sendEvent(res, 'stage', { stage, status: data.status });
    }
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: '仅支持 POST' });
    return;
  }

  const { ticker: rawTicker, date: tradeDate } = req.body;
  if (!rawTicker || !tradeDate) {
    res.status(400).json({ error: '缺少 ticker 或 date 参数' });
    return;
  }

  let ticker: string;
  try {
    ticker = await resolveTicker(rawTicker);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
    return;
  }

  const config = loadConfig();
  if (!config.apiKey) {
    res.status(400).json({ error: '未配置 API Key，请在设置页面配置后再试' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const { finalState, signal } = await runPipeline(
      ticker,
      tradeDate,
      {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        quickModel: config.quickModel,
        deepModel: config.deepModel,
        analysts: config.analysts,
        maxDebateRounds: config.maxDebateRounds,
      },
      createStageCallback(res),
    );

    sendEvent(res, 'complete', {
      decision: finalState.finalTradeDecision,
      signal,
    });

    const parts: string[] = [];
    if (finalState.marketReport) parts.push('## 市场分析\n\n' + finalState.marketReport);
    if (finalState.sentimentReport) parts.push('## 情绪分析\n\n' + finalState.sentimentReport);
    if (finalState.newsReport) parts.push('## 新闻分析\n\n' + finalState.newsReport);
    if (finalState.fundamentalsReport) parts.push('## 基本面分析\n\n' + finalState.fundamentalsReport);
    if (finalState.policyReport) parts.push('## 政策分析\n\n' + finalState.policyReport);
    if (finalState.hotMoneyReport) parts.push('## 资金分析\n\n' + finalState.hotMoneyReport);
    if (finalState.lockupReport) parts.push('## 解禁分析\n\n' + finalState.lockupReport);
    if (finalState.finalTradeDecision) parts.push('## 最终决策\n\n' + finalState.finalTradeDecision);
    const reportParts = parts.join('\n\n---\n\n');

    sendEvent(res, 'report', { content: reportParts });
    sendEvent(res, 'done', {});
  } catch (e: any) {
    sendEvent(res, 'error', { message: e.message });
  }

  res.end();
}
