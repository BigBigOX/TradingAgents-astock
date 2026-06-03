'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props { params: { ticker: string }; searchParams: { date?: string }; }

interface StageInfo {
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  agent?: string;
}

const STAGE_DEFS: { key: string; label: string; icon: string }[] = [
  { key: 'market', label: '市场分析', icon: '\uD83D\uDCCA' },
  { key: 'social', label: '情绪分析', icon: '\uD83D\uDCA1' },
  { key: 'news', label: '新闻分析', icon: '\uD83D\uDCF0' },
  { key: 'fundamentals', label: '基本面分析', icon: '\uD83C\uDFE6' },
  { key: 'policy', label: '政策分析', icon: '\uD83D\uDCCB' },
  { key: 'hot_money', label: '资金分析', icon: '\uD83D\uDCB0' },
  { key: 'lockup', label: '解禁分析', icon: '\uD83D\uDD12' },
  { key: 'quality_gate', label: '质量门控', icon: '\uD83D\uDD0D' },
  { key: 'debate', label: '多空辩论', icon: '\u2696\uFE0F' },
  { key: 'research_manager', label: '研究主管', icon: '\uD83D\uDCDD' },
  { key: 'trader', label: '交易决策', icon: '\uD83D\uDCC8' },
  { key: 'risk', label: '风险评估', icon: '\u26A0\uFE0F' },
  { key: 'pm', label: '投资组合', icon: '\uD83C\uDF1F' },
];

/** Agent 推理消息 */
interface AgentMsg {
  id: string;
  agent: string;
  label: string;
  side?: string;
  content: string;
  round?: number;
}

const AGENT_LABELS: Record<string, string> = {
  market: '\u5E02\u573A\u5206\u6790\u5E08',
  social: '\u60C5\u7EEA\u5206\u6790\u5E08',
  news: '\u65B0\u95FB\u5206\u6790\u5E08',
  fundamentals: '\u57FA\u672C\u9762\u5206\u6790\u5E08',
  policy: '\u653F\u7B56\u5206\u6790\u5E08',
  hot_money: '\u8D44\u91D1\u5206\u6790\u5E08',
  lockup: '\u89E3\u7981\u5206\u6790\u5E08',
  quality_gate: '\u8D28\u91CF\u5B88\u95E8\u5458',
  research_manager: '\u7814\u7A76\u4E3B\u7BA1',
  trader: '\u4EA4\u6613\u51B3\u7B56\u5E08',
  pm: '\u6295\u8D44\u7EC4\u5408\u4E3B\u7BA1',
};

const AGENT_ICONS: Record<string, string> = {
  market: '\uD83D\uDCCA',
  social: '\uD83D\uDCA1',
  news: '\uD83D\uDCF0',
  fundamentals: '\uD83C\uDFE6',
  policy: '\uD83D\uDCCB',
  hot_money: '\uD83D\uDCB0',
  lockup: '\uD83D\uDD12',
  quality_gate: '\uD83D\uDD0D',
  research_manager: '\uD83D\uDCDD',
  trader: '\uD83D\uDCC8',
  pm: '\uD83C\uDF1F',
};

const SIDE_NAMES: Record<string, string> = {
  bull: '\uD83D\uDC02 \u770B\u591A\u65B9',
  bear: '\uD83D\uDC3B \u770B\u7A7A\u65B9',
  aggressive: '\uD83D\uDD25 \u5192\u8FDB\u578B',
  conservative: '\uD83D\uDEE1\uFE0F \u4FDD\u5B88\u578B',
  neutral: '\u2696\uFE0F \u4E2D\u6027\u578B',
};

export default function AnalysisPage({ params, searchParams }: Props) {
  const router = useRouter();
  const ticker = decodeURIComponent(params.ticker);
  const date = searchParams.date || new Date().toISOString().slice(0, 10);

  const [stages, setStages] = useState<Record<string, StageInfo>>({});
  const [messages, setMessages] = useState<AgentMsg[]>([]);
  const [signal, setSignal] = useState<{ text: string; rating?: string; confidence?: number } | null>(null);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const init: Record<string, StageInfo> = {};
    STAGE_DEFS.forEach(s => { init[s.key] = { label: s.label, status: 'pending' }; });
    setStages(init);
  }, []);

  // SSE 接收
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
          const { done: sd, value } = await reader.read();
          if (sd) break;
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
              case 'agent_report': {
                const msg: AgentMsg = {
                  id: d.agent + '_' + Date.now(),
                  agent: d.agent,
                  label: AGENT_LABELS[d.agent] || d.agent,
                  content: d.content,
                };
                setMessages(prev => [...prev, msg]);
                setStages(prev => {
                  const next = { ...prev };
                  if (next[d.agent]) next[d.agent] = { ...next[d.agent], status: 'done' };
                  return next;
                });
                break;
              }
              case 'debate_message': {
                const msg: AgentMsg = {
                  id: 'debate_' + d.side + '_' + d.round,
                  agent: 'debate',
                  label: SIDE_NAMES[d.side] || d.side,
                  side: d.side,
                  content: d.content,
                  round: d.round,
                };
                setMessages(prev => [...prev, msg]);
                break;
              }
              case 'risk_message': {
                const msg: AgentMsg = {
                  id: 'risk_' + d.side + '_' + d.round,
                  agent: 'risk',
                  label: SIDE_NAMES[d.side] || d.side,
                  side: d.side,
                  content: d.content,
                  round: d.round,
                };
                setMessages(prev => [...prev, msg]);
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
                    if (next[k].status === 'running' || next[k].status === 'pending') {
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

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };
  const expandAll = () => {
    const all: Record<string, boolean> = {};
    messages.forEach(m => { all[m.id] = true; });
    setExpanded(all);
  };
  const collapseAll = () => {
    setExpanded({});
  };

  const getRatingDisplay = (rating?: string) => {
    switch (rating) {
      case 'Buy': return { text: '\u4E70\u5165', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' };
      case 'Overweight': return { text: '\u589E\u6301', color: 'text-lime-400', bg: 'bg-lime-500/10 border-lime-500/30' };
      case 'Hold': return { text: '\u6301\u6709', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' };
      case 'Underweight': return { text: '\u51CF\u6301', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
      case 'Sell': return { text: '\u5356\u51FA', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
      default: return { text: rating || '', color: 'text-[#f5f1eb]', bg: 'bg-[#161616] border-[#2a2a2a]' };
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-[#888] hover:text-[#f5f1eb] text-sm transition-colors">
          &larr; 返回
        </button>
        <h1 className="text-xl font-bold">{ticker}</h1>
        <span className="text-sm text-[#555]">{date}</span>
      </div>

      {/* 进度条 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {STAGE_DEFS.map(s => {
          const info = stages[s.key];
          if (!info) return null;
          return (
            <div key={s.key} className={
              'p-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1 ' + (
                info.status === 'done' ? 'bg-green-900/15 border-green-800/30 text-green-300' :
                info.status === 'running' ? 'bg-blue-900/15 border-blue-800/30 text-blue-300' :
                info.status === 'error' ? 'bg-red-900/15 border-red-800/30 text-red-300' :
                'bg-[#161616] border-[#2a2a2a] text-[#555]'
              )
            }>
              <span className="text-xs">{s.icon}</span>
              <span className="truncate">{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* 错误 */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
          <p className="text-red-400 text-sm whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* 信号结果 */}
      {signal && (
        <div className={'p-6 rounded-xl border text-center ' + getRatingDisplay(signal.rating).bg}>
          <p className="text-xs text-[#888] mb-2">综合评级</p>
          <p className={'text-5xl font-extrabold ' + getRatingDisplay(signal.rating).color}>
            {getRatingDisplay(signal.rating).text}
          </p>
          {signal.confidence !== undefined && (
            <p className="text-sm text-[#888] mt-2">
              置信度: {(signal.confidence * 100).toFixed(1)}%
            </p>
          )}
        </div>
      )}

      {/* Agent 推理交锋 */}
      {messages.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
            <h2 className="text-sm font-semibold text-[#f5f1eb]">
              Agent 推理过程 ({messages.length})
            </h2>
            <div className="flex gap-2">
              <button onClick={expandAll} className="text-xs text-[#888] hover:text-[#f5f1eb] transition-colors">
                展开全部
              </button>
              <button onClick={collapseAll} className="text-xs text-[#888] hover:text-[#f5f1eb] transition-colors">
                收起全部
              </button>
            </div>
          </div>
          {/* 消息列表 */}
          <div className="divide-y divide-[#2a2a2a]">
            {messages.map((msg) => {
              const isExpanded = expanded[msg.id];
              const agentIcon = AGENT_ICONS[msg.agent] || '\uD83E\uDD16';
              return (
                <div key={msg.id}>
                  {/* 标题头 — 点击展开/收起 */}
                  <button
                    onClick={() => toggleExpand(msg.id)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[#1a1a1a] transition-colors"
                  >
                    <span className="text-sm shrink-0">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                    <span className="text-sm shrink-0">{agentIcon}</span>
                    <span className="text-sm font-medium text-[#f5f1eb] truncate">{msg.label}</span>
                    {msg.round && (
                      <span className="text-xs text-[#555] shrink-0">\u7B2C{msg.round}\u8F6E</span>
                    )}
                    <span className="text-xs text-[#555] ml-auto shrink-0">
                      {msg.content.length > 100 ? msg.content.slice(0, 50) + '...' : ''}
                    </span>
                  </button>
                  {/* 内容区 */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1">
                      <div className="p-3 bg-[#0f0f0f] rounded-lg text-xs text-[#ccc] leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {msg.content}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 完整报告 */}
      {report && (
        <div className="p-6 bg-[#161616] border border-[#2a2a2a] rounded-xl text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap">
          <h2 className="text-lg font-bold text-[#f5f1eb] mb-4">完整分析报告</h2>
          {report.split('---').map((section, idx) => (
            <div key={idx} className="mb-6">{section}</div>
          ))}
        </div>
      )}

      {/* 加载中 */}
      {!done && !error && !signal && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-sm text-[#555]">
            <span className="w-2 h-2 bg-[#ff5a1f] rounded-full animate-pulse"></span>
            AI 分析进行中，请稍候...
          </div>
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