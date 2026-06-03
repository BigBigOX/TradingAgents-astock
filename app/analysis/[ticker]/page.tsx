'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Props { params: { ticker: string }; searchParams: { date?: string }; }

interface StageInfo {
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

const STAGES: { key: string; label: string }[] = [
  { key: 'resolve', label: '解析股票代码' },
  { key: 'market', label: '市场分析' },
  { key: 'social', label: '情绪分析' },
  { key: 'news', label: '新闻分析' },
  { key: 'fundamentals', label: '基本面分析' },
  { key: 'policy', label: '政策分析' },
  { key: 'hot_money', label: '资金分析' },
  { key: 'lockup', label: '解禁分析' },
  { key: 'debate', label: '多空辩论' },
  { key: 'risk', label: '风险评估' },
  { key: 'trader', label: '交易决策' },
];

export default function AnalysisPage({ params, searchParams }: Props) {
  const router = useRouter();
  const ticker = decodeURIComponent(params.ticker);
  const date = searchParams.date || new Date().toISOString().slice(0, 10);

  const [stages, setStages] = useState<Record<string, StageInfo>>({});
  const [signal, setSignal] = useState<{ text: string; rating?: string; confidence?: number } | null>(null);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const init: Record<string, StageInfo> = {};
    STAGES.forEach(s => { init[s.key] = { label: s.label, status: 'pending' }; });
    setStages(init);
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, date }),
        });
        if (!r.ok) { const e = await r.json().catch(() => ({ error: '请求失败' })); throw new Error(e.error); }
        const reader = r.body?.getReader();
        if (!reader) throw new Error('无法读取响应流');
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            if (cancel) return;
            const d = JSON.parse(line.slice(6));
            switch (d.type) {
              case 'stage': {
                setStages(prev => {
                  const next = { ...prev };
                  if (d.stage && next[d.stage]) {
                    next[d.stage] = { ...next[d.stage], status: 'running' };
                  }
                  return next;
                });
                break;
              }
              case 'complete': {
                const text = d.signal || d.decision || '';
                setSignal({ text, rating: d.rating, confidence: d.confidence });
                break;
              }
              case 'report': {
                if (d.content) setReport(d.content);
                break;
              }
              case 'error': {
                setError(d.message);
                break;
              }
              case 'done': {
                setDone(true);
                setStages(prev => {
                  const next = { ...prev };
                  Object.keys(next).forEach(k => {
                    if (next[k].status === 'pending' || next[k].status === 'running') {
                      next[k] = { ...next[k], status: 'done' };
                    }
                  });
                  return next;
                });
                break;
              }
            }
          }
        }
      } catch (e) {
        if (!cancel) setError((e as Error).message);
      }
    })();
    return () => { cancel = true; };
  }, [ticker, date]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'done': return '\u2705';
      case 'running': return '\u23F3';
      case 'error': return '\u274C';
      default: return '\u2B1C';
    }
  };

  const getRatingColor = (rating?: string) => {
    switch (rating) {
      case 'Buy': return 'text-green-400';
      case 'Overweight': return 'text-lime-400';
      case 'Hold': return 'text-yellow-400';
      case 'Underweight': return 'text-orange-400';
      case 'Sell': return 'text-red-400';
      default: return 'text-[#f5f1eb]';
    }
  };

  const ratingLabel = (rating?: string) => {
    switch (rating) {
      case 'Buy': return '买入';
      case 'Overweight': return '增持';
      case 'Hold': return '持有';
      case 'Underweight': return '减持';
      case 'Sell': return '卖出';
      default: return rating || '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-[#888] hover:text-[#f5f1eb] text-sm transition-colors">
          &larr; 返回
        </button>
        <h1 className="text-xl font-bold">{ticker} 分析报告</h1>
        <span className="text-sm text-[#555]">{date}</span>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
          <p className="text-red-400 text-sm whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* 进度条 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {STAGES.map(s => {
          const info = stages[s.key];
          if (!info) return null;
          return (
            <div key={s.key} className={
              'p-2 rounded-lg text-xs border transition-colors ' + (
                info.status === 'done' ? 'bg-green-900/10 border-green-800/30 text-green-300' :
                info.status === 'running' ? 'bg-blue-900/10 border-blue-800/30 text-blue-300' :
                info.status === 'error' ? 'bg-red-900/10 border-red-800/30 text-red-300' :
                'bg-[#161616] border-[#2a2a2a] text-[#555]'
              )
            }>
              <span className="mr-1">{statusIcon(info.status)}</span>
              {info.label}
            </div>
          );
        })}
      </div>

      {/* 信号结果 */}
      {signal && (
        <div className="p-6 bg-[#161616] border border-[#2a2a2a] rounded-lg">
          <div className="text-center">
            <p className="text-xs text-[#888] mb-1">综合评级</p>
            <p className={'text-4xl font-extrabold ' + getRatingColor(signal.rating)}>
              {ratingLabel(signal.rating) || signal.text}
            </p>
            {signal.confidence !== undefined && (
              <p className="text-sm text-[#888] mt-2">
                置信度: {(signal.confidence * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      )}

      {/* 分析报告 */}
      {report && (
        <div className="p-6 bg-[#161616] border border-[#2a2a2a] rounded-lg text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap">
          <h2 className="text-lg font-bold text-[#f5f1eb] mb-4">完整分析报告</h2>
          {report.split('---').map((section, idx) => (
            <div key={idx} className="mb-6">{section}</div>
          ))}
        </div>
      )}

      {/* 加载中 */}
      {!done && !error && !signal && (
        <div className="text-center py-8">
          <p className="text-sm text-[#555]">AI 分析进行中，请稍候...</p>
        </div>
      )}

      {/* 完成 */}
      {done && (
        <div className="text-center py-4">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-[#161616] border border-[#2a2a2a] rounded-lg text-sm text-[#888] hover:border-[#ff5a1f] transition-colors"
          >
            返回首页
          </button>
        </div>
      )}
    </div>
  );
}