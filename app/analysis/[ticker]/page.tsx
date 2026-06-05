'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReportSlideshow from '../../../components/ReportSlideshow';
import ProgressSlideshow from '../../../components/ProgressSlideshow';

interface Props { params: { ticker: string }; searchParams: { date?: string; taskId?: string }; }

interface StageInfo { label: string; status: 'pending' | 'running' | 'done' | 'error'; }

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

interface AgentMsg { id: string; agent: string; label: string; side?: string; content: string; round?: number; }

const AGENT_LABELS: Record<string, string> = {
  market: '市场分析师', social: '情绪分析师', news: '新闻分析师',
  fundamentals: '基本面分析师', policy: '政策分析师',
  hot_money: '资金分析师', lockup: '解禁分析师',
  quality_gate: '质量守门员', research_manager: '研究主管',
  trader: '交易决策师', pm: '投资组合主管',
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

function extractTickerName(msgs: any[], fallback: string): string {
  for (const m of msgs) {
    const match = m.content.match(/(?:股票名称|股票名|名称|name)[：:]+([^\n]+)/i);
    if (match) return match[1].trim();
  }
  return fallback;
}

export default function AnalysisPage({ params, searchParams }: Props) {
  const router = useRouter();
  const ticker = decodeURIComponent(params.ticker);
  const date = searchParams.date || new Date().toISOString().slice(0, 10);
  const existingTaskId = searchParams.taskId;

  const [stages, setStages] = useState<Record<string, StageInfo>>({});
  const [messages, setMessages] = useState<AgentMsg[]>([]);
  const [signal, setSignal] = useState<{ text: string; rating?: string; confidence?: number } | null>(null);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showDebug, setShowDebug] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(existingTaskId || null);
  const [tickerName, setTickerName] = useState<string>('');
  const [status, setStatus] = useState<string>(existingTaskId ? 'polling' : 'idle');
  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init: Record<string, StageInfo> = {};
    STAGE_DEFS.forEach(s => { init[s.key] = { label: s.label, status: 'pending' }; });
    setStages(init);
  }, []);

  useEffect(() => {
    if (msgEndRef.current) msgEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 应用后端返回的状态到前端 state
  const applyState = useCallback((data: any) => {
    if (data.progress?.stages) {
      setStages(prev => {
        const next = { ...prev };
        Object.entries(data.progress.stages as Record<string, any>).forEach(([key, val]) => {
          if (next[key]) next[key] = { ...next[key], status: val.status === 'running' ? 'running' : 'done' };
        });
        return next;
      });
    }
    if (data.progress?.messages && data.progress.messages.length > 0) {
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMsgs = (data.progress.messages as any[]).filter((m: any) => !existingIds.has(m.id));
        if (newMsgs.length === 0) return prev;
        const labeled = newMsgs.map(m => ({
          ...m, label: AGENT_LABELS[m.agent] || (SIDE_NAMES[m.side] || m.side || m.agent),
        }));
        setExpanded(ex => {
          const next = { ...ex };
          newMsgs.forEach(m => { next[m.id] = true; });
          return next;
        });
        return [...prev, ...labeled];
      });
    }
    if (data.signal) setSignal(typeof data.signal === 'string' ? { text: data.signal } : data.signal);
    if (data.report) setReport(data.report);
    if (data.error) setError(data.error);
    if (data.tickerName) setTickerName(data.tickerName);
    if (data.done) setDone(true);
  }, []);

  // 轮询任务
  useEffect(() => {
    if (!taskId) return;
    let cancel = false;
    let pollTimer: any = null;

    const poll = async () => {
      if (cancel) return;
      try {
        const r = await fetch('/api/analyze?id=' + taskId);
        if (!r.ok) return;
        const data = await r.json();
        if (cancel) return;
        applyState(data);
        if (!data.done && data.status !== 'error') {
          pollTimer = setTimeout(poll, 1500);
        }
      } catch {
        pollTimer = setTimeout(poll, 2000);
      }
    };
    poll();

    return () => { cancel = true; if (pollTimer) clearTimeout(pollTimer); };
  }, [taskId, applyState]);

  // 启动新分析
  const startAnalysis = useCallback(async () => {
    setStatus('starting');
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, date }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({ error: '请求失败' })); throw new Error(e.error); }
      const data = await r.json();

      if (data.cached) {
        applyState(data);
        setStatus('done');
        return;
      }

      if (!data.taskId) throw new Error('未获取到任务 ID');
      setTaskId(data.taskId);

      // 更新 URL（添加 taskId 参数，刷新不重建）
      const url = new URL(window.location.href);
      url.searchParams.set('taskId', data.taskId);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }, [ticker, date, applyState]);

  // 页面加载时：如果有 taskId 就轮询，否则启动分析
  useEffect(() => {
    if (status !== 'idle') return;
    setStatus('running');
    if (taskId) {
      // 有 taskId 只轮询（刷新或从历史记录进入）
      setStatus('polling');
    } else {
      startAnalysis();
    }
  }, [status, taskId, startAnalysis]);

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const expandAll = () => { const all: Record<string, boolean> = {}; messages.forEach(m => { all[m.id] = true; }); setExpanded(all); };
  const collapseAll = () => setExpanded({});

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

  const progressText = () => {
    const total = STAGE_DEFS.length;
    const doneCount = Object.values(stages).filter(s => s.status === 'done').length;
    return doneCount + '/' + total;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 pb-20">
      {/* 顶部导航 */}
      <div className="flex items-center gap-3 pt-4">
        <button onClick={() => router.push('/')} className="text-[#888] hover:text-[#f5f1eb] text-sm transition-colors">← 返回</button>
        <h1 className="text-xl font-bold text-[#f5f1eb]">{done && tickerName ? tickerName + " " + ticker : ticker}</h1>
        <span className="text-sm text-[#555]">{date}</span>
        {status === 'polling' && !done && <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800/30">恢复查看</span>}
        {done && <span className="text-xs px-2 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-800/30">已完成</span>}
      </div>

      {/* 进度幻灯片 — 分析进行中的视觉反馈 */}
      {!done && (
        <ProgressSlideshow
          stages={stages}
          stageDefs={STAGE_DEFS}
          messages={messages}
          done={done}
        />
      )}

      {/* 信号结果 */}
      {signal && (
        <div className={'p-6 rounded-xl border text-center ' + getRatingDisplay(signal.rating).bg}>
          <p className="text-xs text-[#888] mb-2">综合评级</p>
          <p className={'text-5xl font-extrabold ' + getRatingDisplay(signal.rating).color}>
            {getRatingDisplay(signal.rating).text}
          </p>
        </div>
      )}


      {/* 幻灯片演示 */}
{done && (
        <ReportSlideshow
          ticker={ticker}
          tickerName={tickerName || ticker}
          tradeDate={date}
          signal={signal}
          messages={messages}
          report={report}
        />
      )}
      {/* Agent 推理过程 */}
      {messages.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <button onClick={()=>setShowDebug(!showDebug)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#1a1a1a] text-left transition-colors">
            <span className="text-xs text-[#888]">{showDebug ? "▼" : "▶"}</span>
            <span className="text-sm font-medium text-[#f5f1eb]">🧠 Agent推理过程</span>
            <span className="text-xs text-[#555] ml-1">({messages.length}条)</span>
          </button>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a]">
            <div className="flex items-center gap-2">
              {/* old header hidden */}
              {!done && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
              <span className="text-xs text-[#555]">（{messages.length} 条）</span>
            </div>
            <div className="flex gap-3">
              {/* expand/collapse hidden */}
              {/* collapse hidden */}
            </div>
          </div>
          <div className="divide-y divide-[#2a2a2a] max-h-[600px] overflow-y-auto">
            {messages.map((msg) => {
              const isExpanded = expanded[msg.id];
              const agentIcon = AGENT_ICONS[msg.agent] || '🤖';
              const isDebate = msg.agent === 'debate';
              const isRisk = msg.agent === 'risk';
              return (
                <div key={msg.id} className={isDebate ? 'bg-blue-900/5' : isRisk ? 'bg-orange-900/5' : ''}>
                  <button onClick={() => toggleExpand(msg.id)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[#1a1a1a] transition-colors">
                    <span className="text-xs shrink-0 text-[#888]">{isExpanded ? '▼' : '▶'}</span>
                    <span className="text-sm shrink-0">{agentIcon}</span>
                    <span className="text-sm font-medium text-[#f5f1eb] truncate">{msg.label}</span>
                    {msg.round && <span className="text-xs px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[#888] shrink-0">第{msg.round}轮</span>}
                    <span className="text-xs text-[#555] ml-auto shrink-0">
                      {msg.content.length > 120 ? msg.content.slice(0, 60) + '...' : ''}
                    </span>
                  </button>
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


      {/* 加载中（启动阶段弹跳动画） */}
      {!done && !error && messages.length === 0 && status === "starting" && (
        <div className="text-center py-12">
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ff5a1f] animate-bounce [animation-delay:0ms]" />
              <span className="w-3 h-3 rounded-full bg-[#ff8c42] animate-bounce [animation-delay:150ms]" />
              <span className="w-3 h-3 rounded-full bg-[#00E5FF] animate-bounce [animation-delay:300ms]" />
            </div>
            <p className="text-sm text-[#888]">正在启动分析引擎...</p>
            <p className="text-xs text-[#555]">多 Agent 协作系统准备中</p>
          </div>
        </div>
      )}

      {/* 完整报告 */}
      {report && (
        <div className="p-6 bg-[#161616] border border-[#2a2a2a] rounded-xl text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-[#f5f1eb]">📄 完整分析报告</h2><button onClick={()=>setShowReports(!showReports)} className="text-xs text-[#888] hover:text-white px-3 py-1 rounded bg-[#2a2a2a]">{showReports?"收起":"查看"}</button></div>
          {showReports && report.split('---').map((section, idx) => (
            <div key={idx} className="mb-6">{section}</div>
          ))}
        </div>
      )}

      {/* 完成 */}
      {done && (
        <div className="text-center py-4">
          <button onClick={() => router.push('/')}
            className="px-6 py-2 bg-[#161616] border border-[#2a2a2a] rounded-lg text-sm text-[#888] hover:border-[#ff5a1f] transition-colors">
            返回首页
          </button>
        </div>
      )}
    </div>
  );
}

