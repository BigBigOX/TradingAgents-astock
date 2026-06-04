'use client';
import { useEffect, useState } from 'react';

interface ProgressSlideshowProps {
  stages: Record<string, { label: string; status: "pending" | "running" | "done" | "error" }>;
  stageDefs: { key: string; label: string; icon: string }[];
  messages: { id: string; agent: string; label: string; content: string }[];
  done: boolean;
}

const CARD_ORDER = [
  { id: "overview", icon: String.fromCodePoint(0x1F680), title: "分析概览" },
  { id: "running", icon: String.fromCodePoint(0x26A1), title: "当前进行" },
  { id: "completed", icon: String.fromCodePoint(0x2705), title: "已完成" },
  { id: "pipeline", icon: String.fromCodePoint(0x1F52C), title: "智能流水线" },
];

export default function ProgressSlideshow({ stages, stageDefs, messages, done }: ProgressSlideshowProps) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [autoTimer, setAutoTimer] = useState<number>(0);

  useEffect(() => {
    if (done) return;
    const t = window.setInterval(() => {
      setSlideIdx(prev => (prev + 1) % CARD_ORDER.length);
    }, 5000);
    setAutoTimer(t);
    return () => clearInterval(t);
  }, [done]);

  const handleManualNav = (idx: number) => {
    clearInterval(autoTimer);
    setSlideIdx(idx);
    const t = window.setInterval(() => {
      setSlideIdx(prev => (prev + 1) % CARD_ORDER.length);
    }, 5000);
    setAutoTimer(t);
  };

  const runningCount = Object.values(stages).filter(s => s.status === "running").length;
  const doneCount = Object.values(stages).filter(s => s.status === "done").length;
  const total = stageDefs.length;
  const pct = total > 0 ? Math.round(doneCount / total * 100) : 0;

  const runningStage = stageDefs.find(s => stages[s.key]?.status === "running");
  const lastMsg = messages[messages.length - 1];
  var runningStageObj = stageDefs.find(function(s) { return stages[s.key] && stages[s.key].status === "running"; });
  var curAgentLabel = runningStageObj ? runningStageObj.label : (done ? "????" : "???...");
  var curAgentDesc = runningStageObj ? "? " + (stageDefs.indexOf(runningStageObj) + 1) + " / " + stageDefs.length + " ?" : "";


  return (
    <div className="bg-[#0f0f0f] border border-[#222] rounded-2xl overflow-hidden select-none">
      <div className="relative min-h-[240px]">
        {/* 幻灯片 0: 分析概览 */}
        {slideIdx === 0 && (
          <div className="p-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">{String.fromCodePoint(0x1F680)}</span>
              <div>
                <h3 className="text-base font-bold text-[#f5f1eb]">分析概览</h3>
                <p className="text-xs text-[#888]">全方位多 Agent 智能分析</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-8 mb-4">
              <div className="relative w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#222" strokeWidth="8" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="url(#pg)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${pct * 3.27} ${(100 - pct) * 3.27}`} className="transition-all duration-700 ease-out" />
                  <defs>
                    <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ff5a1f" />
                      <stop offset="50%" stopColor="#ff8c42" />
                      <stop offset="100%" stopColor="#00E5FF" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-[#f5f1eb]">{pct}%</span>
                  <span className="text-[10px] text-[#888]">已完成</span>
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-xs text-[#ccc]">{doneCount} 已完成</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-xs text-[#ccc]">{runningCount} 进行中</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#333]" />
                  <span className="text-xs text-[#555]">{total - doneCount - runningCount} 待处理</span>
                </div>
              </div>
            </div>
            <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: pct + "%", background: "linear-gradient(90deg, #ff5a1f, #ff8c42, #00E5FF)", backgroundSize: "200% 100%", animation: "shimmer 2s linear infinite" }} />
            </div>
            {!done && (
              <p className="text-center text-[10px] text-[#555] mt-2">
                每个 Agent 分析预计 10-30 秒，可关闭页面稍后来看结果
              </p>
            )}
          </div>
        )}

        {/* 幻灯片 1: 当前进行 */}
        {slideIdx === 1 && (
          <div className="p-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">{String.fromCodePoint(0x26A1)}</span>
              <div>
                <h3 className="text-base font-bold text-[#f5f1eb]">当前进行</h3>
                <p className="text-xs text-[#888]">正在运行的智能分析任务</p>
              </div>
            </div>
            <div className="space-y-3">
              {stageDefs.filter(s => stages[s.key]?.status === "running").length > 0 ? (
                stageDefs.filter(s => stages[s.key]?.status === "running").map(s => (
                  <div key={s.key} className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-900/15 to-purple-900/15 border border-blue-800/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]">
                    <span className="w-3 h-3 rounded-full bg-blue-400 animate-ping shrink-0" />
                    <span className="text-lg">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-300">{s.label}</p>
                      <p className="text-[10px] text-blue-400/60">AI 分析推理中...</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-400 border border-blue-800/30">运行中</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#161616] border border-[#2a2a2a]">
                  <span className="w-3 h-3 rounded-full bg-[#555] animate-pulse shrink-0" />
                  <span className="text-sm text-[#555]">等待任务调度...</span>
                </div>
              )}
              {lastMsg && !done && (
                <div className="mt-2 p-3 rounded-lg bg-[#121212] border border-[#222]">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-[#ff5a1f] animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#f5f1eb] font-medium mb-0.5">{lastMsg.label || lastMsg.agent}</p>
                      <p className="text-[11px] text-[#888] line-clamp-2">
                        {lastMsg.content?.slice(0, 200).replace(/\n/g, " ")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 幻灯片 2: 已完成 */}
        {slideIdx === 2 && (
          <div className="p-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">{String.fromCodePoint(0x2705)}</span>
              <div>
                <h3 className="text-base font-bold text-[#f5f1eb]">已完成分析</h3>
                <p className="text-xs text-[#888]">{doneCount}/{total} 个阶段已就绪</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {stageDefs.map(s => {
                const info = stages[s.key];
                const isDone = info?.status === "done";
                const isRunning = info?.status === "running";
                const isPending = !isDone && !isRunning;
                return (
                  <div key={s.key} className={"p-2.5 rounded-xl text-xs border transition-all duration-500 flex items-center gap-2 " + (isDone ? "bg-green-900/15 border-green-800/30 text-green-300" : isRunning ? "bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-800/40 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.2)]" : "bg-[#161616] border-[#2a2a2a] text-[#555]")}>
                    <span>{s.icon}</span>
                    <span className="flex-1 truncate">{s.label}</span>
                    {isDone && <span className="text-green-400 text-[10px]">{String.fromCodePoint(0x2713)}</span>}
                    {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
                    {isPending && <span className="w-1.5 h-1.5 rounded-full bg-[#333]" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 幻灯片 3: 智能流水线 */}
        {slideIdx === 3 && (
          <div className="p-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">{String.fromCodePoint(0x1F52C)}</span>
              <div>
                <h3 className="text-base font-bold text-[#f5f1eb]">智能流水线</h3>
                <p className="text-xs text-[#888]">多 Agent 协作处理流程</p>
              </div>
            </div>
            <div className="relative">
              <div className="flex items-center overflow-x-auto gap-1 pb-2 scrollbar-none">
                {stageDefs.map((s, idx) => {
                  const info = stages[s.key];
                  const isDone = info?.status === "done";
                  const isRunning = info?.status === "running";
                  return (
                    <div key={s.key} className="flex items-center gap-1 shrink-0">
                      <div className={"w-9 h-9 rounded-lg flex items-center justify-center text-sm border transition-all duration-500 " + (isDone ? "bg-green-900/30 border-green-700/50 shadow-[0_0_6px_rgba(34,197,94,0.2)]" : isRunning ? "bg-blue-900/30 border-blue-700/50 shadow-[0_0_8px_rgba(59,130,246,0.3)] scale-110" : "bg-[#161616] border-[#2a2a2a] opacity-40")}>
                        {isDone ? String.fromCodePoint(0x2713) : isRunning ? String.fromCodePoint(0x26A1) : s.icon}
                      </div>
                      {idx < stageDefs.length - 1 && (
                        <div className={"w-3 h-[2px] rounded-full " + (isDone ? "bg-green-700/50" : "bg-[#222]")} />
                      )}
                    </div>
                  );
                })}
              </div>
              {runningStage ? (
                <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-blue-900/10 to-purple-900/10 border border-blue-800/20">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{runningStage.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-blue-300">{runningStage.label}</p>
                      <p className="text-[10px] text-blue-400/60">{stageDefs.indexOf(runningStage) + 1} / {stageDefs.length}</p>
                    </div>
                  </div>
                </div>
              ) : !done ? (
                <div className="mt-4 p-3 rounded-lg bg-[#161616] border border-[#2a2a2a]">
                  <p className="text-xs text-[#555] text-center">流水线初始化中...</p>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* 导航点 */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {CARD_ORDER.map((_, idx) => (
            <button key={idx} onClick={() => handleManualNav(idx)} className={"w-2 h-2 rounded-full transition-all duration-300 " + (idx === slideIdx ? "bg-[#ff5a1f] w-4" : "bg-[#333] hover:bg-[#555]")} />
          ))}
        </div>
      </div>
    </div>
  );
}
