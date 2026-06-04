'use client';
import { useEffect, useState, useRef } from 'react';

interface ProgressSlideshowProps {
  stages: Record<string, { label: string; status: 'pending' | 'running' | 'done' | 'error' }>;
  stageDefs: { key: string; label: string; icon: string }[];
  messages: { id: string; agent: string; label: string; content: string }[];
  done: boolean;
}

const PIPELINE_ORDER = [
  { key: 'market', label: '市场分析', desc: '分析股价走势、技术指标' },
  { key: 'social', label: '情绪分析', desc: '监测市场情绪、舆论风向' },
  { key: 'news', label: '新闻分析', desc: '抓取相关新闻、事件驱动' },
  { key: 'fundamentals', label: '基本面分析', desc: '评估财务数据、业绩指标' },
  { key: 'policy', label: '政策分析', desc: '解读政策影响、行业导向' },
  { key: 'hot_money', label: '资金分析', desc: '追踪主力资金、大单流向' },
  { key: 'lockup', label: '解禁分析', desc: '检查解禁压力、减持风险' },
  { key: 'quality_gate', label: '质量门控', desc: '验证数据质量、补充缺失' },
  { key: 'debate', label: '多空辩论', desc: '牛熊双方多轮观点交锋' },
  { key: 'research_manager', label: '研究主管', desc: '汇总分析、形成投资方案' },
  { key: 'trader', label: '交易决策', desc: '制定具体买卖策略' },
  { key: 'risk', label: '风险评估', desc: '多维度风控压力测试' },
  { key: 'pm', label: '投资组合', desc: '最终决策、生成综合报告' },
];

export default function ProgressSlideshow({ stages, stageDefs, messages, done }: ProgressSlideshowProps) {
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  const [currentMsg, setCurrentMsg] = useState<{ agent: string; label: string } | null>(null);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    setCurrentMsg({ agent: last.agent, label: last.label });
  }, [messages.length]);

  const doneCount = Object.values(stages).filter((s: any) => s.status === 'done').length;
  const runningCount = Object.values(stages).filter((s: any) => s.status === 'running').length;
  const total = stageDefs.length;
  const pct = total > 0 ? Math.round(doneCount / total * 100) : 0;
  const runningStage = stageDefs.find((s: any) => stages[s.key]?.status === 'running');

  // 估算剩余时间：基于已完成的平均耗时 × 剩余步骤
  const estimatedRemaining = (() => {
    if (done) return 0;
    if (doneCount === 0) return null; // 还不好估算
    const avgSec = elapsed / doneCount;
    const remaining = Math.ceil(avgSec * (total - doneCount));
    if (remaining < 60) return remaining + '秒';
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    return min + '分' + sec + '秒';
  })();

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? m + '分' + sec + '秒' : sec + '秒';
  };

  return (
    <div className="bg-[#0f0f0f] border border-[#222] rounded-2xl overflow-hidden">
      <div className="p-5">
        {/* 大进度环 */}
        <div className="flex items-center gap-6 mb-5">
          <div className="relative w-24 h-24 shrink-0">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#222" strokeWidth="8"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke="url(#pg)" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${pct * 3.27} ${(100 - pct) * 3.27}`}
                className="transition-all duration-700 ease-out"/>
              <defs><linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff5a1f"/>
                <stop offset="50%" stopColor="#ff8c42"/>
                <stop offset="100%" stopColor="#00E5FF"/>
              </linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-[#f5f1eb]">{pct}%</span>
              <span className="text-[10px] text-[#888]">已完成</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-[#f5f1eb]">分析进度</span>
              <span className="text-xs text-[#555]">已耗时 {formatTime(elapsed)}</span>
              {estimatedRemaining && <span className="text-xs text-[#ff8c42]">预计剩余 ~{estimatedRemaining}</span>}
            </div>
            <div className="flex gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500"/>
                <span className="text-[#aaa]">{doneCount} 已完成</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"/>
                <span className="text-[#aaa]">{runningCount} 进行中</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#333]"/>
                <span className="text-[#555]">{total - doneCount - runningCount} 待处理</span>
              </div>
            </div>
          </div>
        </div>
        {/* 当前执行 */}
        {runningStage ? (
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/15 via-purple-900/10 to-blue-900/15 border border-blue-800/30 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{runningStage.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-300">{runningStage.label}</span>
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"/>
                </div>
                <span className="text-xs text-blue-400/60">
                  第 {stageDefs.indexOf(runningStage) + 1}/{total} 步
                </span>
              </div>
              <div className="text-xs text-[#555]">{formatTime(elapsed)}</div>
            </div>
            {/* 当前 streaming 消息 */}
            {currentMsg && (
              <div className="mt-2 p-3 rounded-lg bg-[#0f0f0f]/80 border border-[#2a2a2a]">
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">💬</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#888] mb-1">{currentMsg.label}</p>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]"/>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]"/>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]"/>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : !done ? (
          <div className="p-4 rounded-xl bg-[#161616] border border-[#2a2a2a] text-center mb-4">
            <p className="text-xs text-[#555]">流水线初始化中...</p>
          </div>
        ) : null}

        {/* 流水线可视化 */}
        <div className="mb-4">
          <div className="text-xs text-[#555] mb-3 font-medium">分析流水线进度</div>
          <div className="flex flex-wrap gap-1.5">
            {stageDefs.map((s: any, idx: number) => {
              const info = stages[s.key];
              const isDone = info?.status === 'done';
              const isRunning = info?.status === 'running';
              const isPending = !isDone && !isRunning;
              return (
                <div key={s.key} className="relative group">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-all duration-500 ${
                      isDone ? 'bg-green-900/40 border-green-700/60 shadow-[0_0_8px_rgba(34,197,94,0.2)]' :
                      isRunning ? 'bg-blue-900/40 border-blue-700/60 shadow-[0_0_10px_rgba(59,130,246,0.3)] scale-110 ring-1 ring-blue-500/50' :
                      'bg-[#161616] border-[#2a2a2a] opacity-50'
                    }`}>
                    {isDone ? '✓' : isRunning ? '⚡' : s.icon}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-[#222] text-[10px] text-[#ccc] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* 最新消息 */}
        {messages.length > 0 && (
          <div className="p-3 rounded-lg bg-[#161616] border border-[#2a2a2a]">
            <div className="text-[10px] text-[#555] mb-1.5 font-medium">最新反馈</div>
            <div className="h-12 overflow-hidden">
              <div className="space-y-1 animate-scroll">
                {messages.slice(-5).reverse().map((msg: any, i: number) => (
                  <div key={msg.id} className="flex items-center gap-1.5 text-xs">
                    <span className="text-[#333]">▸</span>
                    <span className="text-[#888] truncate">{msg.label}:</span>
                    <span className="text-[#555] truncate flex-1">{msg.content.slice(0, 80)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}