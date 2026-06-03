'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Props { params: { ticker: string }; searchParams: { date?: string }; }

interface StageInfo {
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
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
  const reportRef = useRef<HTMLDivElement>(null);

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
                    next[d.stage] = { ...next[d.stage], status: 'running', detail: d.message || d.detail };
                  }
                  return next;
                });
                break;
              }
              case 'complete': {
                const s = d.signal || d.decision || '';
                setSignal({ text: s, rating: d.rating, confidence: d.confidence });
                Object.keys(stages).forEach(k => {
                  setStages(prev => {
                    const n = { ...prev };
                    if (n[k] && (n[k].status === 'pending' || n[k].status === 'running')) {
                      n[k] = { ...n[k], status: 'done' };
                    }
                    return n;
                  });
                });
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
      default: return '\u23FA';
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-[#888] hover:text-[#f5f1eb] text-sm transition-colors">
          \u2190 返回
        </button>
        <h1 className="text-xl font-bold">{ticker} \u5206\u6790\u62a5\u544a</h1>
        <span className="text-sm text-[#555]">{date}</span>
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {STAGES.map(s => {
          const info = stages[s.key];
          if (!info) return null;
          return (
            <div key={s.key} className={'p-2 rounded-lg text-xs border transition-colors ' + (
              info.status === 'done' ? 'bg-green-900/10 border-green-800/30 text-green-300' :
              info.status === 'running' ? 'bg-blue-900/10 border-blue-800/30 text-blue-300' :
              info.status === 'error' ? 'bg-red-900/10 border-red-800/30 text-red-300' :
              'bg-[#161616] border-[#2a2a2a] text-[#555]'
            )}>
              <span className="mr-1">{statusIcon(info.status)}</span>
              {info.label}
            </div>
          );
        })}
      </div>

      {signal && (
        <div className="p-6 bg-[#161616] border border-[#2a2a2a] rounded-lg animate-fade-in">
          <div className="text-center">
            <p className="text-xs text-[#888] mb-1">\u7efc\u5408\u8bc4\u7ea7</p>
            <p className={'text-4xl font-extrabold ' + getRatingColor(signal.rating)}>
              {signal.text || signal.rating}
            </p>
            {signal.confidence !== undefined && (
              <p className="text-sm text-[#888] mt-2">
                \u4fe1\u5fc3\u5ea6: {(signal.confidence * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      )}

      {report && (
        <div ref={reportRef} className="p-6 bg-[#161616] border border-[#2a2a2a] rounded-lg text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap animate-fade-in">
          <h2 className="text-lg font-bold text-[#f5f1eb] mb-4">\u5b8c\u6574\u5206\u6790\u62a5\u544a</h2>
          {report.split('---').map((section, idx) => (
            <div key={idx} className="mb-6">{section}</div>
          ))}
        </div>
      )}

      {!done && !error && !signal && (
        <div className="text-center py-8">
          <p className="text-sm text-[#555] animate-pulse-text">AI \u5206\u6790\u8fdb\u884c\u4e2d\uff0c\u8bf7\u7a0d\u5019...</p>
        </div>
      )}

      {done && (
        <div className="text-center py-4">
          <button onClick={() => router.push('/')} className="px-6 py-2 bg-[#161616] border border-[#2a2a2a] rounded-lg text-sm text-[#888] hover:border-[#ff5a1f] transition-colors">
            \u8fd4\u56de\u9996\u9875
          </button>
        </div>
      )}
    </div>
  );
}