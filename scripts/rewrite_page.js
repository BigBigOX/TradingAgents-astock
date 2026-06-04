const fs = require("fs");
const outPath = "D:/project/TradingAgents-astock/app/analysis/[ticker]/page.tsx";

const l = [];
function add(s) { l.push(s); }

add("'use client';");
add("import { useState, useEffect, useRef, useCallback } from 'react';");
add("import { useRouter } from 'next/navigation';");
add("import ReportSlideshow from '../../../components/ReportSlideshow';");
add("import ProgressSlideshow from '../../../components/ProgressSlideshow';");
add("");
add("interface Props { params: { ticker: string }; searchParams: { date?: string; taskId?: string }; }");
add("interface StageInfo { label: string; status: 'pending' | 'running' | 'done' | 'error'; }");
add("");
add("const STAGE_DEFS = [");
add("  { key: 'market', label: '市场分析', icon: '📊' },");
add("  { key: 'social', label: '情绪分析', icon: '💡' },");
add("  { key: 'news', label: '新闻分析', icon: '📰' },");
add("  { key: 'fundamentals', label: '基本面分析', icon: '🏦' },");
add("  { key: 'policy', label: '政策分析', icon: '📋' },");
add("  { key: 'hot_money', label: '资金分析', icon: '💰' },");
add("  { key: 'lockup', label: '解禁分析', icon: '🔒' },");
add("  { key: 'quality_gate', label: '质量门控', icon: '🔍' },");
add("  { key: 'debate', label: '多空辩论', icon: '⚖️' },");
add("  { key: 'research_manager', label: '研究主管', icon: '📝' },");
add("  { key: 'trader', label: '交易决策', icon: '📈' },");
add("  { key: 'risk', label: '风险评估', icon: '⚠️' },");
add("  { key: 'pm', label: '投资组合', icon: '🌟' },");
add("];");
add("");
add("interface AgentMsg { id: string; agent: string; label: string; side?: string; content: string; round?: number; }");
add("const SIDE_NAMES = { bull: '🐂 多方', bear: '🐻 空方', aggressive: '🔥 冒进型', conservative: '🛡️ 保守型', neutral: '⚖️ 中性型' };");
add("");
add("function extractTickerName(msgs, fallback) {");
add("  for (const m of msgs) {");
add("    const match = m.content.match(/(?:股票名称|股票名|名称|name)[：:]+([^\\n]+)/i);");
add("    if (match) return match[1].trim();");
add("  }");
add("  return fallback;");
add("}");
add("");
add("export default function AnalysisPage({ params, searchParams }) {");
add("  const router = useRouter();");
add("  const ticker = decodeURIComponent(params.ticker);");
add("  const date = searchParams.date || new Date().toISOString().slice(0, 10);");
add("  const existingTaskId = searchParams.taskId;");
add("  const [stages, setStages] = useState({});");
add("  const [messages, setMessages] = useState([]);");
add("  const [signal, setSignal] = useState(null);");
add("  const [report, setReport] = useState('');");
add("  const [error, setError] = useState('');");
add("  const [done, setDone] = useState(false);");
add("  const [expanded, setExpanded] = useState({});");
add("  const [taskId, setTaskId] = useState(existingTaskId || null);");
add("  const [status, setStatus] = useState(existingTaskId ? 'polling' : 'idle');");
add("  const [showDebug, setShowDebug] = useState(false);");
add("  const [showFullReport, setShowFullReport] = useState(false);");
add("  const msgEndRef = useRef(null);");
add("");
add("  useEffect(() => {");
add("    const init = {};");
add("    STAGE_DEFS.forEach(s => { init[s.key] = { label: s.label, status: 'pending' }; });");
add("    setStages(init);");
add("  }, []);");
add("  useEffect(() => { if (msgEndRef.current) msgEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages]);");

// applyState function
add("  const applyState = useCallback((data) => {");
add("    if (data.progress?.stages) {");
add("      setStages(prev => {");
add("        const next = { ...prev };");
add("        Object.entries(data.progress.stages).forEach(([key, val]) => {");
add("          if (next[key]) next[key] = { ...next[key], status: val.status === 'running' ? 'running' : 'done' };");
add("        });");
add("        return next;");
add("      });");
add("    }");
add("    if (data.progress?.messages?.length > 0) {");
add("      setMessages(prev => {");
add("        const existing = new Set(prev.map(m => m.id));");
add("        const newMsgs = data.progress.messages.filter(m => !existing.has(m.id));");
add("        if (!newMsgs.length) return prev;");
add("        setExpanded(ex => { const next = { ...ex }; newMsgs.forEach(m => { next[m.id] = true; }); return next; });");
add("        return [...prev, ...newMsgs];");
add("      });");
add("    }");
add("    if (data.signal) setSignal(typeof data.signal === 'string' ? { text: data.signal } : data.signal);");
add("    if (data.report) setReport(data.report);");
add("    if (data.error) setError(data.error);");
add("    if (data.done) setDone(true);");
add("  }, []);");

// Polling
add("  useEffect(() => {");
add("    if (!taskId) return;");
add("    setStatus('polling');");
add("    const poll = () => {");
add("      fetch('/api/analyze?id=' + taskId)");
add("        .then(r => r.json())");
add("        .then(data => {");
add("          applyState(data);");
add("          if (!data.done && data.status !== 'error') setTimeout(poll, 2000);");
add("          else { setStatus('idle'); if (data.status === 'error') setError(data.error || '分析失败'); }");
add("        })");
add("        .catch(() => { setTimeout(poll, 2000); });");
add("    };");
add("    poll();");
add("    return () => setStatus('idle');");
add("  }, [taskId, applyState]);");

// Start analysis
add("  useEffect(() => {");
add("    if (existingTaskId || taskId) return;");
add("    setStatus('starting');");
add("    const start = async () => {");
add("      try {");
add("        const r = await fetch('/api/analyze', {");
add("          method: 'POST', headers: { 'Content-Type': 'application/json' },");
add("          body: JSON.stringify({ ticker, date }),");
add("        });");
add("        const data = await r.json();");
add("        if (data.taskId) {");
add("          applyState(data);");
add("          setTaskId(data.taskId);");
add("        } else if (data.cached) {");
add("          applyState(data);");
add("          setDone(true);");
add("        }");
add("      } catch(e) {");
add("        setError('请求失败: ' + e.message);");
add("      }");
add("    };");
add("    start();");
add("  }, [ticker, date, existingTaskId, taskId, applyState]);");

add("  const getRatingDisplay = (rating) => {");
add("    switch(rating) {");
add("      case 'strong_buy': case 'StrongBuy': return { text: '强烈买入', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' };");
add("      case 'buy': case 'Buy': return { text: '买入', color: 'text-lime-400', bg: 'bg-lime-500/10 border-lime-500/30' };");
add("      case 'hold': case 'Hold': return { text: '持有', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' };");
add("      case 'sell': case 'Sell': return { text: '卖出', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };");
add("      case 'strong_sell': case 'StrongSell': return { text: '强烈卖出', color: 'text-red-500', bg: 'bg-red-600/10 border-red-600/30' };");
add("      default: return { text: rating || '', color: 'text-[#f5f1eb]', bg: 'bg-[#161616] border-[#2a2a2a]' };");
add("    }");
add("  };");
add("  const getRunningAgent = () => { for (const [k,v] of Object.entries(stages)) { if (v.status==='running') return v.label; } return null; };");
add("  const progressText = () => { const d = Object.values(stages).filter(s=>s.status==='done').length; return d+'/'+STAGE_DEFS.length; };");

add("  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));");
add("  const expandAll = () => { const e = {}; messages.forEach(m => { e[m.id] = true; }); setExpanded(e); };");
add("  const collapseAll = () => setExpanded({});");

// RETURN START
add("  return (");
add('    <div className="max-w-4xl mx-auto space-y-6 px-4 pb-20">');

// Top bar
add('      <div className="flex items-center gap-3 pt-4">');
add('        <button onClick={() => router.push("/")} className="text-[#888] hover:text-[#f5f1eb] text-sm transition-colors">← 返回</button>');
add('        <h1 className="text-xl font-bold text-[#f5f1eb]">{ticker}</h1>');
add('        <span className="text-sm text-[#555]">{date}</span>');
add('        {status === "polling" && !done && <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800/30">恢复查看</span>}');
add('        {done && <span className="text-xs px-2 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-800/30">已完成</span>}');
add("      </div>");

// Progress slideshow (during analysis)
add("      {!done && (");
add("        <ProgressSlideshow stages={stages} stageDefs={STAGE_DEFS} messages={messages} done={done} />");
add("      )}");

// Signal
add("      {signal && (");
add('        <div className={"p-6 rounded-xl border text-center " + getRatingDisplay(signal.rating).bg}>');
add('          <p className="text-xs text-[#888] mb-2">综合评级</p>');
add('          <p className={"text-5xl font-extrabold " + getRatingDisplay(signal.rating).color}>{getRatingDisplay(signal.rating).text}</p>');
add("        </div>");
add("      )}");

// ReportSlideshow (main visual output)
add("      {done && signal && messages.length > 0 && (");
add("        <ReportSlideshow");
add("          ticker={ticker}");
add("          tickerName={extractTickerName(messages, ticker)}");
add("          tradeDate={date}");
add("          signal={signal}");
add("          messages={messages} report={report}");
add("        />");
add("      )}");

// Agent debug section (folded by default)
add('      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">');
add('        <button onClick={()=>setShowDebug(!showDebug)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#1a1a1a] text-left transition-colors">');
add('          <span className="text-xs text-[#888]">{showDebug ? "▼" : "▶"}</span>');
add('          <span className="text-sm font-medium text-[#f5f1eb]">🧠 Agent推理过程</span>');
add('          <span className="text-xs text-[#555] ml-1">({messages.length}条)</span>');
add("        </button>");
add("        {showDebug && (");
add('          <div className="divide-y divide-[#2a2a2a] max-h-[600px] overflow-y-auto">');
add("            {messages.map((msg) => (");
add("              <div key={msg.id}>");
add('                <button onClick={() => toggleExpand(msg.id)} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[#1a1a1a] transition-colors">');
add('                  <span className="text-xs shrink-0 text-[#888]">{expanded[msg.id] ? "▼" : "▶"}</span>');
add("                  <span className=\"text-sm\">{msg.agent === 'debate' ? (msg.side==='bull'?'🐂':msg.side==='bear'?'🐻':'⚖️') : msg.agent === 'risk' ? '⚠️' : '🤖'}</span>");
add('                  <span className="text-sm font-medium text-[#f5f1eb] truncate">{msg.label}</span>');
add("                  {msg.round && <span className='text-xs px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[#888] shrink-0'>第{msg.round}轮</span>}");
add("                </button>");
add("                {expanded[msg.id] && (");
add('                  <div className="px-4 pb-3 pt-1">');
add('                    <div className="p-3 bg-[#0f0f0f] rounded-lg text-xs text-[#ccc] leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto border border-[#222]">{msg.content}</div>');
add("                  </div>");
add("                )}");
add("              </div>");
add("            ))}");
add("            <div ref={msgEndRef} />");
add("          </div>");
add("        )}");
add("      </div>");

// Loading animation
add('      {!done && !error && messages.length === 0 && status === "starting" && (');
add('        <div className="text-center py-12">');
add('          <div className="space-y-4">');
add('            <div className="flex justify-center gap-2">');
add('              <span className="w-3 h-3 rounded-full bg-[#ff5a1f] animate-bounce [animation-delay:0ms]" />');
add('              <span className="w-3 h-3 rounded-full bg-[#ff8c42] animate-bounce [animation-delay:150ms]" />');
add('              <span className="w-3 h-3 rounded-full bg-[#00E5FF] animate-bounce [animation-delay:300ms]" />');
add("            </div>");
add('            <p className="text-sm text-[#888]">正在启动分析引擎...</p>');
add('            <p className="text-xs text-[#555]">多 Agent 协作系统准备中</p>');
add("          </div>");
add("        </div>");
add("      )}");

// Full report (folded by default)
add("      {report && (");
add('        <div className="p-6 bg-[#161616] border border-[#2a2a2a] rounded-xl text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap">');
add('          <div className="flex items-center justify-between mb-4">');
add('            <h2 className="text-lg font-bold text-[#f5f1eb]">📄 完整分析报告</h2>');
add('            <button onClick={()=>setShowFullReport(!showFullReport)} className="text-xs text-[#888] hover:text-white px-3 py-1 rounded bg-[#2a2a2a]">{showFullReport ? "收起" : "查看"}</button>');
add("          </div>");
add("          {showFullReport && report.split('---').map((section, idx) => (");
add('            <div key={idx} className="mb-6">{section}</div>');
add("          ))}");
add("        </div>");
add("      )}");

// Done button
add("      {done && (");
add('        <div className="text-center py-4">');
add('          <button onClick={() => router.push("/")} className="px-6 py-2 bg-[#161616] border border-[#2a2a2a] rounded-lg text-sm text-[#888] hover:border-[#ff5a1f] transition-colors">返回首页</button>');
add("        </div>");
add("      )}");

add("    </div>");
add("  );");
add("}");

fs.writeFileSync(outPath, l.join("\n"), "utf-8");
console.log("Analysis page rewritten: " + l.length + " lines");
