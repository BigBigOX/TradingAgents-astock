'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Props { params: { ticker: string }; searchParams: { date?: string }; }

interface StageInfo {
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  agent?: string;
}

const STAGE_DEFS: { key: string; label: string; icon: string }[] = [
  { key: 'market', label: '市场分析', icon: '📊' },
  { key: 'social', label: '情绪分析', icon: '💡' },
  { key: 'news', label: '新闻分析', icon: '📰' },
  { key: 'fundamentals', label: '基本面分析', icon: '🏦' },
  { key: 'policy', label: '政策分析', icon: '📋' },
  { key: 'hot_money', label: '资金分析', icon: '💰' },
  { key: 'lockup', label: '解禁分析', icon: '🔒' },
  { key: 'quality_gate', label: '质量门控', icon: '🔍' },
  { key: 'debate', label: '多空辩论', icon: '⚖️' },
  { key: 'research_manager', label: '研究主管', icon: '📝' },
  { key: 'trader', label: '交易决策', icon: '📈' },
  { key: 'risk', label: '风险评估', icon: '⚠️' },
  { key: 'pm', label: '投资组合', icon: '🌟' },
];

interface AgentMsg {
  id: string;
  agent: string;
  label: string;
  side?: string;
  content: string;
  round?: number;
  streaming?: boolean;
}

const AGENT_LABELS: Record<string, string> = {
  market: '市场分析师',
  social: '情绪分析师',
  news: '新闻分析师',
  fundamentals: '基本面分析师',
  policy: '政策分析师',
  hot_money: '资金分析师',
  lockup: '解禁分析师',
  quality_gate: '质量守门员',
  research_manager: '研究主管',
  trader: '交易决策师',
  pm: '投资组合主管',
};

const AGENT_ICONS: Record<string, string> = {
  market: '📊', social: '💡', news: '📰', fundamentals: '🏦',
  policy: '📋', hot_money: '💰', lockup: '🔒', quality_gate: '🔍',
  research_manager: '📝', trader: '📈', pm: '🌟',
};

const SIDE_NAMES: Record<string, string> = {
  bull: '🐂 多方', bear: '🐻 空方',
  aggressive: '🔥 冒进型', conservative: '🛡️ 保守型', neutral: '⚖️ 中性型',
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
  const [autoScroll, setAutoScroll] = useState(true);
  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init: Record<string, StageInfo> = {};
    STAGE_DEFS.forEach(s => { init[s.key] = { label: s.label, status: 'pending' }; });
    setStages(init);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && msgEndRef.current) {
      msgEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

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
                    next[d.stage] = { ...next[d.stage], status: d.status === 'running' ? 'running' : 'done' };
                  }
                  return next;
                });
                break;
              }
              case 'agent_report': {
                const id = d.agent + '_' + Date.now();
                setMessages(prev => prev.some(m => m.id === id) ? prev : [...prev, {
                  id,
                  agent: d.agent,
                  label: AGENT_LABELS[d.agent] || d.agent,
                  content: d.content,
                }]);
                // 自动展开新消息
                setExpanded(prev => ({ ...prev, [id]: true }));
                setStages(prev => {
                  const next = { ...prev };
                  if (next[d.agent]) next[d.agent] = { ...next[d.agent], status: 'done' };
                  return next;
                });
                break;
              }
              case 'debate_message': {
                const id = 'debate_' + d.side + '_' + d.round;
                setMessages(prev => [...prev, {
                  id,
                  agent: 'debate',
                  label: SIDE_NAMES[d.side] || d.side,
                  side: d.side,
                  content: d.content,
                  round: d.round,
                }]);
                setExpanded(prev => ({ ...prev, [id]: true }));
                break;
              }
              case 'risk_message': {
                const id = 'risk_' + d.side + '_' + d.round;
                setMessages(prev => [...prev, {
                  id,
                  agent: 'risk',
                  label: SIDE_NAMES[d.side] || d.side,
                  side: d.side,
                  content: d.content,
                  round: d.round,
                }]);
                setExpanded(prev => ({ ...prev, [id]: true }));
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

  const toggleExpand = (id: string) => { setExpanded(prev => ({ ...prev, [id]: !prev[id] })); };
  const expandAll = () => { const all: Record<string, boolean> = {}; messages.forEach(m => { all[m.id] = true; }); setExpanded(all); };
  const collapseAll = () => { setExpanded({}); };

  const getRatingDisplay = (rating?: string) => {
    switch (rating) {
      case 'Buy': return { text: '买入', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' };
      case 'Overweight': return { text: '增持', color: 'text-lime-400', bg: 'bg-lime-500/10 border-lime-500/30' };
      case 'Hold': return { text: '持有', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' };
      case 'Underweight': return { text: '减持', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
      case 'Sell': return { text: '卖出', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
      default: return { text: rating || '', color: 'text-[#f5f1eb]', bg: 'bg-[#161616] border-[#2a2a2a]' };
    }
  };

  const getRunningAgent = () => {
    for (const [key, info] of Object.entries(stages)) {
      if (info.status === 'running') return info.label;
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 pb-20">
      {/* 顶部导航 */}
      <div className="flex items-center gap-3 pt-4">
        <button onClick={() => router.push('/')} className="text-[#888] hover:text-[#f5f1eb] text-sm transition-colors">
          ← 返回
        </button>
        <h1 className="text-xl font-bold text-[#f5f1eb]">{ticker}</h1>
        <span className="text-sm text-[#555]">{date}</span>
      </div>

      {/* 进度条 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {STAGE_DEFS.map(s => {
          const info = stages[s.key];
          if (!info) return null;
          const isRunning = info.status === 'running';
          const isDone = info.status === 'done';
          return (
            <div key={s.key} className={
              'p-1.5 rounded-lg text-xs border transition-all flex items-center gap-1 ' +
              (isDone ? 'bg-green-900/15 border-green-800/30 text-green-300' :
               isRunning ? 'bg-blue-900/15 border-blue-800/30 text-blue-300 animate-pulse' :
               info.status === 'error' ? 'bg-red-900/15 border-red-800/30 text-red-300' :
               'bg-[#161616] border-[#2a2a2a] text-[#555]')
            }>
              <span className="text-xs">{s.icon}</span>
              <span className="truncate">{s.label}</span>
              {isRunning && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* 当前运行状态 */}
      {(() => { const r = getRunningAgent(); return r ? (
        <div className="flex items-center gap-2 text-sm text-[#888] px-1">
          <span className="w-2 h-2 bg-[#ff5a1f] rounded-full animate-pulse" />
          正在运行：{r}
        </div>
      ) : null; })()}

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
            <p className="text-sm text-[#888] mt-2">置信度 {(signal.confidence * 100).toFixed(1)}%</p>
          )}
        </div>
      )}

      {/* Agent 推理交锋 - 实时展示 */}
      {messages.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#f5f1eb]">🧠 Agent 推理过程</h2>
              {!done && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
              <span className="text-xs text-[#555]">({messages.length} 条)</span>
            </div>
            <div className="flex gap-3">
              <button onClick={expandAll} className="text-xs text-[#888] hover:text-[#f5f1eb] transition-colors">
                展开全部
              </button>
              <button onClick={collapseAll} className="text-xs text-[#888] hover:text-[#f5f1eb] transition-colors">
                收起全部
              </button>
            </div>
          </div>
          {/* 消息列表 */}
          <div className="divide-y divide-[#2a2a2a] max-h-[600px] overflow-y-auto">
            {messages.map((msg) => {
              const isExpanded = expanded[msg.id];
              const agentIcon = AGENT_ICONS[msg.agent] || '🤖';
              const isDebate = msg.agent === 'debate';
              const isRisk = msg.agent === 'risk';
              return (
                <div key={msg.id} className={isDebate ? 'bg-blue-900/5' : isRisk ? 'bg-orange-900/5' : ''}>
                  {/* 标题头 —— 点击展开/收起 */}
                  <button
                    onClick={() => toggleExpand(msg.id)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[#1a1a1a] transition-colors"
                  >
                    <span className="text-xs shrink-0 text-[#888]">{isExpanded ? '▼' : '▶'}</span>
                    <span className="text-sm shrink-0">{agentIcon}</span>
                    <span className="text-sm font-medium text-[#f5f1eb] truncate">{msg.label}</span>
                    {msg.round && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[#888] shrink-0">第{msg.round}轮</span>
                    )}
                    <span className="text-xs text-[#555] ml-auto shrink-0">
                      {msg.content.length > 120 ? msg.content.slice(0, 60) + '...' : ''}
                    </span>
                  </button>
                  {/* 内容区 */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 animate-fadeIn">
                      <div className="p-3 bg-[#0f0f0f] rounded-lg text-xs text-[#ccc] leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto border border-[#222]">
                        {msg.content}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={msgEndRef} />
          </div>
        </div>
      )}

      {/* 加载中 */}
      {!done && !error && !signal && messages.length === 0 && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-sm text-[#555]">
            <span className="w-2 h-2 bg-[#ff5a1f] rounded-full animate-pulse"></span>
            AI 分析进行中，请稍候...
          </div>
        </div>
      )}

      {/* 完整报告 */}
      {report && (
        <div className="p-6 bg-[#161616] border border-[#2a2a2a] rounded-xl text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap">
          <h2 className="text-lg font-bold text-[#f5f1eb] mb-4">📄 完整分析报告</h2>
          {report.split('---').map((section, idx) => (
            <div key={idx} className="mb-6">{section}</div>
          ))}
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
