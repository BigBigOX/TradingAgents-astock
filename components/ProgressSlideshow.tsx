'use client';
import { useEffect, useRef } from 'react';

interface ExtStage { key: string; label: string; icon: string; }
interface ExtMsg { id: string; agent: string; label: string; content: string; side?: string; round?: number; }

interface Props {
  stages: Record<string, { label: string; status: 'pending' | 'running' | 'done' | 'error' }>;
  stageDefs: ExtStage[];
  messages: ExtMsg[];
  done: boolean;
}

const ANIM_DELAY = [0, 150, 300];

export default function ProgressSlideshow({ stages, stageDefs, messages, done }: Props) {
  const msgEndRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(done);
  doneRef.current = done;

  useEffect(() => {
    if (msgEndRef.current && !doneRef.current) {
      msgEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const doneCount = Object.values(stages).filter((s: any) => s.status === 'done').length;
  const total = stageDefs.length;
  const runningStage = stageDefs.find((s: any) => stages[s.key]?.status === 'running');

  return (
    <div className="bg-[#0f0f0f] border border-[#222] rounded-2xl overflow-hidden">
      <div className="p-4">
        {/* 进度条 */}
        <div className="flex items-center gap-3 mb-4">
          {/* 大环 */}
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#222" strokeWidth="8"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke="url(#pgProg)" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${Math.round(doneCount/total*100) * 3.27} ${(100 - Math.round(doneCount/total*100)) * 3.27}`}
                className="transition-all duration-700 ease-out"/>
              <defs><linearGradient id="pgProg" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff5a1f"/>
                <stop offset="50%" stopColor="#ff8c42"/>
                <stop offset="100%" stopColor="#00E5FF"/></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-extrabold text-[#f5f1eb]">{Math.round(doneCount/total*100)}%</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-[#f5f1eb]">分析进度</span>
              <span className="text-xs text-[#555]">{doneCount}/{total} 步</span>
            </div>
            <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{width: Math.round(doneCount/total*100)+'%', background: 'linear-gradient(90deg, #ff5a1f, #ff8c42, #00E5FF)'}}/>
            </div>
            <div className="flex gap-3 mt-1.5 text-[10px]">
              <span className="text-green-400">✓ {doneCount} 完成</span>
              {runningStage && <span className="text-blue-400 animate-pulse">⚡ {runningStage.label}</span>}
              <span className="text-[#555]">{total - doneCount} 待处理</span>
            </div>
          </div>
        </div>
        {/* Agent 消息流 */}
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {stageDefs.map((s: any) => {
            const info = stages[s.key];
            const relatedMsgs = messages.filter((m: any) => m.agent === s.key);
            if (!info || (info.status as string) === 'pending') return null;
            const isRunning = info.status === 'running';
            const isDone = info.status === 'done';
            const isError = info.status === 'error';

            return (
              <div key={s.key} className={`rounded-xl border transition-all duration-300 overflow-hidden ${
                isRunning ? 'border-blue-800/50 bg-gradient-to-r from-blue-900/10 to-purple-900/10' :
                isDone ? 'border-green-900/30 bg-[#161616]' :
                isError ? 'border-red-800/50 bg-red-900/10' :
                'border-[#2a2a2a] bg-[#161616]'
              }`}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-sm">{s.icon}</span>
                  <span className={`text-sm font-medium flex-1 ${isRunning ? 'text-blue-300' : isDone ? 'text-green-300' : isError ? 'text-red-300' : 'text-[#ccc]'}`}>
                    {s.label}
                  </span>
                  {isRunning && <span className="flex gap-0.5">{ANIM_DELAY.map((d,i) => <span key={i} className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{animationDelay: d+'ms'}}/>)}</span>}
                  {isDone && <span className="text-green-400 text-xs">✓</span>}
                  {isError && <span className="text-red-400 text-xs">✗</span>}
                  {info.status === 'pending' && <span className="w-1 h-1 rounded-full bg-[#333]"/>}
                </div>
                {(isRunning || (isDone && relatedMsgs.length > 0)) && (
                  <div className="px-3 pb-3">
                    {relatedMsgs.map((msg: any) => (
                      <div key={msg.id} className="p-2.5 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] mt-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs mt-0.5">{msg.side === 'bull' ? '🐂' : msg.side === 'bear' ? '🐻' : msg.agent === 'debate' ? '⚖️' : msg.agent === 'risk' ? '⚠️' : '💬'}</span>
                          <div className="flex-1 min-w-0">
                            {msg.round && <span className="text-[10px] text-[#555] block mb-0.5">第{msg.round}轮</span>}
                            <div className="text-[11px] text-[#aaa] leading-relaxed whitespace-pre-wrap break-words line-clamp-4">
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {isRunning && relatedMsgs.length === 0 && (
                      <div className="p-2.5 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] mt-2">
                        <div className="flex items-center gap-2 text-xs text-[#555]">
                          <span>⏳</span>
                          <span>正在分析...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {messages.filter((m:any) => m.agent === 'debate' || m.agent === 'risk').map((msg: any) => {
            const sideColor = msg.side === 'bull' ? 'text-green-400' : msg.side === 'bear' ? 'text-red-400' : msg.side === 'aggressive' ? 'text-orange-400' : msg.side === 'conservative' ? 'text-blue-400' : 'text-yellow-400';
            return (
              <div key={msg.id} className="rounded-xl border border-purple-900/30 bg-[#161616] overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2">
                  <span>{msg.agent === 'debate' ? '⚖️' : '⚠️'}</span>
                  <span className={'text-sm font-medium flex-1 ' + sideColor}>
                    {msg.side === 'bull' ? '🐂 多方' : msg.side === 'bear' ? '🐻 空方' : msg.side === 'aggressive' ? '🔥 冒进型' : msg.side === 'conservative' ? '🛡️ 保守型' : '⚖️ 中性型'}
                    {msg.round && <span className="text-[10px] text-[#555] ml-1">第{msg.round}轮</span>}
                  </span>
                </div>
                <div className="px-3 pb-3">
                  <div className="p-2.5 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a]">
                    <div className="text-[11px] text-[#aaa] leading-relaxed whitespace-pre-wrap break-words line-clamp-4">
                      {msg.content}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={msgEndRef} />
        </div>
        {!done && Object.values(stages).filter((s:any)=>s.status!=='pending').length === 0 && (
          <div className="text-center py-8">
            <div className="flex justify-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#ff5a1f] animate-bounce [animation-delay:0ms]"/>
              <span className="w-2 h-2 rounded-full bg-[#ff8c42] animate-bounce [animation-delay:150ms]"/>
              <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-bounce [animation-delay:300ms]"/>
            </div>
            <p className="text-xs text-[#555]">正在启动分析引擎...</p>
          </div>
        )}
      </div>
    </div>
  );
}