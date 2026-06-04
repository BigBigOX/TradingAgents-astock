'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface SlideshowProps {
  ticker: string;
  tickerName: string;
  tradeDate: string;
  signal?: { text: string; rating?: string; confidence?: number } | null;
  messages: { id: string; agent: string; label: string; side?: string; content: string; round?: number }[];
  report: string;
}

const AGENT_ICONS: Record<string, string> = {
  market: '📊', social: '💡', news: '📰', fundamentals: '🏦',
  policy: '📋', hot_money: '💰', lockup: '🔒', quality_gate: '🔍',
  research_manager: '📝', trader: '📈', pm: '🌟',
};

const AGENT_LABELS: Record<string, string> = {
  market: '市场分析', social: '情绪分析', news: '新闻分析',
  fundamentals: '基本面分析', policy: '政策分析',
  hot_money: '资金分析', lockup: '解禁分析',
  quality_gate: '质量门控', research_manager: '研究主管',
  trader: '交易决策', pm: '投资组合',
};

const RATING_MAP: Record<string, string> = {
  strong_buy: 'Strong Buy', buy: 'Buy', hold: 'Hold', sell: 'Sell', strong_sell: 'Strong Sell',
};
const RATING_CN: Record<string, string> = {
  strong_buy: '强烈买入', buy: '买入', hold: '持有', sell: '卖出', strong_sell: '强烈卖出',
};
const RATING_COLOR: Record<string, string> = {
  strong_buy: '#00E676', buy: '#69F0AE', hold: '#FFD740', sell: '#FF5252', strong_sell: '#D50000',
};
const RATING_BG: Record<string, string> = {
  strong_buy: 'rgba(0,230,118,0.15)', buy: 'rgba(105,240,174,0.12)',
  hold: 'rgba(255,215,64,0.12)', sell: 'rgba(255,82,82,0.15)',
  strong_sell: 'rgba(213,0,0,0.15)',
};

function getFromMsg(messages: { agent: string; content: string }[], agent: string): string {
  return messages.find(m => m.agent === agent)?.content || '';
}

function extractScore(content: string): number | null {
  const m = content.match(/(?:评分|得分)[：:]\s*(\d+(?:\.\d+)?)/);
  if (m) return Math.min(10, Math.max(0, parseFloat(m[1])));
  const m2 = content.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
  if (m2) return Math.min(10, Math.max(0, parseFloat(m2[1])));
  return null;
}

function extractReg(content: string, pattern: RegExp): string {
  return content.match(pattern)?.[1] || '--';
}

function extractOneLiner(content: string): string {
  const m = content.match(/(?:一句话|总结|核心观点|结论)[：:]\s*([^\u3002\n]+)/);
  if (m) return m[1].trim();
  const firstLine = content.split(/[\u3002\n]/)[0]?.trim();
  return firstLine?.length > 60 ? firstLine.slice(0, 60) + '...' : (firstLine || '');
}

function extractKPI(content: string, label: string, pattern: RegExp): { label: string; value: string; color?: string } {
  const val = content.match(pattern)?.[1] || '--';
  const isPos = val.startsWith('+');
  const isNeg = val.startsWith('-');
  return { label, value: val, color: isPos ? '#00E676' : isNeg ? '#FF5252' : undefined };
}



function getRatingStyle(rating: string) {
  switch (rating) {
    case "strong_buy": case "buy":
      return { color: "#00E676", bg: "rgba(0,230,118,0.12)", border: "rgba(0,230,118,0.3)" };
    case "sell": case "strong_sell":
      return { color: "#FF5252", bg: "rgba(255,82,82,0.12)", border: "rgba(255,82,82,0.3)" };
    default:
      return { color: "#FFD740", bg: "rgba(255,215,64,0.12)", border: "rgba(255,215,64,0.3)" };
  }
}

const TOTAL_PAGES = 10;

export default function ReportSlideshow(props: SlideshowProps) {
  const { ticker, tickerName, tradeDate, signal, messages, report } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [chartLoaded, setChartLoaded] = useState(false);
  const touchX = useRef(0);
  const chartInstances = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).Chart) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
      script.onload = () => setChartLoaded(true);
      document.head.appendChild(script);
    } else if (typeof window !== "undefined" && (window as any).Chart) {
      setChartLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!chartLoaded) return;
    chartInstances.current.forEach(c => c?.destroy());
    chartInstances.current = [];
    const t = setTimeout(() => renderCharts(), 200);
    return () => { clearTimeout(t); chartInstances.current.forEach(c => c?.destroy()); };
  }, [chartLoaded, current, messages]);

  function renderCharts() {
    const Chart = (window as any).Chart;
    if (!Chart) return;
    const instances: any[] = [];
    const fundCanvas = document.getElementById("chart-fund-flow") as HTMLCanvasElement;
    if (fundCanvas) {
      const ctx = fundCanvas.getContext("2d");
      if (ctx) {
        const c = new Chart(ctx, {
          type: "bar",
          data: {
            labels: ["Main force", "Large orders", "Retail"],
            datasets: [{
              label: "Fund flow",
              data: [
                parseFloat(extractReg(getFromMsg(messages,"hot_money"),/\u4e3b\u529b.*?\u51c0[\u6d41\u8fdb][\uff1a:]\s*([+-]?\d+(?:\.\d+)?)/))||0,
                parseFloat(extractReg(getFromMsg(messages,"hot_money"),/\u5927\u5355.*?\u51c0[\u6d41\u8fdb][\uff1a:]\s*([+-]?\d+(?:\.\d+)?)/))||0,
                parseFloat(extractReg(getFromMsg(messages,"hot_money"),/\u6563\u6237.*?\u51c0[\u6d41\u8fdb][\uff1a:]\s*([+-]?\d+(?:\.\d+)?)/))||0,
              ],
              backgroundColor: ["rgba(0,230,118,0.7)","rgba(0,229,255,0.7)","rgba(255,107,0,0.7)"],
              borderColor: ["#00E676","#00E5FF","#FF6B00"],
              borderWidth: 1,
            }],
          },
          options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#888" } },
                      y: { grid: { display: false }, ticks: { color: "#888" } } }
          },
        });
        instances.push(c);
      }
    }
    const debateCanvas = document.getElementById("chart-debate") as HTMLCanvasElement;
    if (debateCanvas) {
      const ctx = debateCanvas.getContext("2d");
      if (ctx) {
        const bull = extractScore(getFromMsg(messages,"debate"))||5;
        const bear = 10 - bull;
        const c = new Chart(ctx, {
          type: "bar",
          data: {
            labels: ["Bull","Bear"],
            datasets: [{
              label: "Strength",
              data: [bull, bear],
              backgroundColor: ["rgba(0,230,118,0.7)","rgba(255,82,82,0.7)"],
              borderColor: ["#00E676","#FF5252"],
              borderWidth: 1,
            }],
          },
          options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#888" }, max: 10 },
                      y: { grid: { display: false }, ticks: { color: "#888", font: { size: 14 } } } }
          },
        });
        instances.push(c);
      }
    }
    const radarCanvas = document.getElementById("chart-radar") as HTMLCanvasElement;
    if (radarCanvas) {
      const ctx = radarCanvas.getContext("2d");
      if (ctx) {
        const dims = ["market","social","hot_money","fundamentals","policy","lockup"];
        const scores = dims.map(d => extractScore(getFromMsg(messages,d))||5);
        const labels = dims.map(d => AGENT_LABELS[d]);
        const c = new Chart(ctx, {
          type: "radar",
          data: {
            labels,
            datasets: [{
              label: "Score",
              data: scores,
              backgroundColor: "rgba(0,229,255,0.15)",
              borderColor: "#00E5FF",
              borderWidth: 2,
              pointBackgroundColor: "#00E5FF",
              pointBorderColor: "#fff",
              pointRadius: 4,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              r: { beginAtZero: true, max: 10,
                grid: { color: "rgba(255,255,255,0.08)" },
                ticks: { display: false },
                pointLabels: { color: "#888", font: { size: 10 } }
              },
            },
          },
        });
        instances.push(c);
      }
    }
    chartInstances.current = instances;
  }

  useEffect(() => { if (!showHint) return; const t = setTimeout(() => setShowHint(false), 4000); return () => clearTimeout(t); }, [showHint]);

  useEffect(() => { const onFS = () => setFullscreen(!!document.fullscreenElement); document.addEventListener("fullscreenchange", onFS); return () => document.removeEventListener("fullscreenchange", onFS); }, []);

  const toggleFS = useCallback(async () => { const el = containerRef.current; if (!el) return; if (!document.fullscreenElement) { await el.requestFullscreen(); } else { await document.exitFullscreen(); } }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { setCurrent(p => Math.max(0, p - 1)); e.preventDefault(); }
      else if (e.key === "ArrowRight") { setCurrent(p => Math.min(TOTAL_PAGES - 1, p + 1)); e.preventDefault(); }
      else if (e.key === "f" || e.key === "F") { toggleFS(); }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [toggleFS]);

  const rating = signal?.rating || "hold";
  const ratingText = RATING_MAP[rating] || rating;
  const ratingTextCN = RATING_CN[rating] || rating;
  const ratingStyle = getRatingStyle(rating);
  const isBullish = rating === "strong_buy" || rating === "buy";
  const isBearish = rating === "sell" || rating === "strong_sell";

  const marketContent = getFromMsg(messages, "market");
  const socialContent = getFromMsg(messages, "social");
  const hotMoneyContent = getFromMsg(messages, "hot_money");

  const kpiItems: any[] = [];
  const actionItems: any[] = [];
  const coveragePct = 100;

  const handleTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) setCurrent(p => Math.min(TOTAL_PAGES - 1, p + 1));
      else setCurrent(p => Math.max(0, p - 1));
    }
  };
  const navigate = (dir: number) => setCurrent(p => Math.max(0, Math.min(TOTAL_PAGES - 1, p + dir)));

  if (!chartLoaded) {
    return (
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] p-12 text-center">
        <div className="inline-flex items-center gap-2 text-sm text-[#555]">
          <span className="w-2 h-2 bg-[#ff5a1f] rounded-full animate-pulse" />
          Loading library...
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] overflow-hidden select-none focus:outline-none" tabIndex={0} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="relative min-h-[420px]">
        {current === 0 && (
          <div className="p-8 animate-fadeIn min-h-[400px] flex flex-col items-center justify-center">
            <div className="text-center mb-6"><h1 className="text-3xl font-extrabold text-[#f5f1eb] mb-2">{ticker}</h1><p className="text-sm text-[#888]">{tickerName || ticker} - {tradeDate}</p></div>
            <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl border-2" style={{backgroundColor: ratingStyle.bg, borderColor: ratingStyle.border}}><span className="text-4xl font-black" style={{color: ratingStyle.color}}>{ratingTextCN}</span><span className="text-lg text-[#888]">{ratingText}</span></div>
            <p className="text-sm text-[#ccc] mt-4 max-w-md text-center">{signal?.text || "Report"}</p>
          </div>
        )}
        {current === 1 && (
          <div className="p-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-5"><span className="text-2xl">O</span><div><h3 className="text-base font-bold text-[#f5f1eb]">Dashboard</h3><p className="text-xs text-[#888]">Scores</p></div></div>
            <div className="grid grid-cols-4 gap-3 mb-5">{kpiItems.map(function(item, i) { return <div key={i} className="p-3 rounded-xl bg-[#161616] border border-[#2a2a2a] text-center"><p className="text-[10px] text-[#888] mb-1">{item.label}</p><p className="text-lg font-bold text-[#f5f1eb]">{item.value}</p></div>; })}</div>
            <div className="flex items-center justify-center"><div className="w-72 h-72"><canvas id="chart-radar" /></div></div>
          </div>
        )}
        {current === 2 && (<div className="p-6 animate-fadeIn"><div className="flex items-center gap-3 mb-5"><span className="text-2xl">F</span><div><h3 className="text-base font-bold text-[#f5f1eb]">Fund Flow</h3><p className="text-xs text-[#888]">Flow</p></div></div><div className="h-56"><canvas id="chart-fund-flow" /></div></div>)}
        {current === 3 && (<div className="p-6 animate-fadeIn"><div className="flex items-center gap-3 mb-5"><span className="text-2xl">B</span><div><h3 className="text-base font-bold text-[#f5f1eb]">Sentiment</h3><p className="text-xs text-[#888]">Comparison</p></div></div><div className="h-56"><canvas id="chart-debate" /></div></div>)}
        {current === 4 && (<div className="p-6 animate-fadeIn"><div className="flex items-center gap-3 mb-5"><span className="text-2xl">S</span><div><h3 className="text-base font-bold text-[#f5f1eb]">Sentiment & News</h3></div></div><div className="grid grid-cols-2 gap-4"><div className="p-4 rounded-xl bg-[#161616] border border-[#2a2a2a]"><p className="text-xs text-[#888] mb-2">Sentiment</p><p className="text-sm text-[#ccc] font-medium">{extractOneLiner(socialContent)||"N/A"}</p></div><div className="p-4 rounded-xl bg-[#161616] border border-[#2a2a2a]"><p className="text-xs text-[#888] mb-2">News</p><p className="text-sm text-[#ccc] font-medium">{extractOneLiner(getFromMsg(messages,"news"))||"N/A"}</p></div></div></div>)}
        {current === 5 && (<div className="p-6 animate-fadeIn"><div className="flex items-center gap-3 mb-5"><span className="text-2xl">G</span><div><h3 className="text-base font-bold text-[#f5f1eb]">Fundamentals</h3></div></div><div className="grid grid-cols-2 gap-4"><div className="p-4 rounded-xl border-2" style={{borderColor:isBearish?"rgba(255,82,82,0.3)":"rgba(0,230,118,0.3)",backgroundColor:isBearish?"rgba(255,82,82,0.05)":"rgba(0,230,118,0.05)"}}><p className="text-xs text-[#888] mb-2">Fundamentals</p><p className="text-sm text-[#ccc] font-medium">{extractOneLiner(getFromMsg(messages,"fundamentals"))||"N/A"}</p></div><div className="p-4 rounded-xl bg-[#161616] border border-[#2a2a2a]"><p className="text-xs text-[#888] mb-2">Policy</p><p className="text-sm text-[#ccc] font-medium">{extractOneLiner(getFromMsg(messages,"policy"))||"N/A"}</p></div></div></div>)}
        {current === 6 && (<div className="p-6 animate-fadeIn"><div className="flex items-center gap-3 mb-5"><span className="text-2xl">L</span><div><h3 className="text-base font-bold text-[#f5f1eb]">Lockup</h3></div></div><div className="p-4 rounded-xl bg-[#161616] border border-[#2a2a2a]"><p className="text-xs text-[#888] mb-2">Summary</p><p className="text-sm text-[#ccc] font-medium">{extractOneLiner(getFromMsg(messages,"lockup"))||"N/A"}</p></div></div>)}
        {current === 7 && (<div className="p-6 animate-fadeIn"><div className="flex items-center gap-3 mb-5"><span className="text-2xl">C</span><div><h3 className="text-base font-bold text-[#f5f1eb]">Coverage</h3></div></div><div className="p-3 rounded-lg bg-[#161616] border border-[#2a2a2a]"><p className="text-xs text-[#555] text-center">Coverage: {Math.round(coveragePct)}%</p></div></div>)}
        {current === 8 && (<div className="p-6 animate-fadeIn"><div className="flex items-center gap-3 mb-5"><span className="text-2xl">A</span><div><h3 className="text-base font-bold text-[#f5f1eb]">Actions</h3></div></div><div className="space-y-3">{actionItems.map(function(item,i){return <div key={i} className="flex items-center gap-3 p-4 rounded-xl" style={{backgroundColor:item.color+"0D",border:"1px solid "+item.color+"30"}}><span className="text-3xl">{item.emoji}</span><div><p className="text-sm font-bold text-[#f5f1eb]">{item.role}</p><p className="text-xs" style={{color:item.color}}>{item.action}</p></div></div>})}</div></div>)}
        {current === 9 && (<div className="p-8 animate-fadeIn min-h-[400px] flex flex-col items-center justify-center"><span className="text-5xl mb-4">R</span><h3 className="text-lg font-bold text-[#f5f1eb] mb-3">Disclaimer</h3><p className="text-xs text-[#555] text-center max-w-sm leading-relaxed">AI generated. Not advice.</p></div>)}
      </div>
      <div className="flex items-center justify-between px-6 py-3 border-t border-[#2a2a2a]">
        <button onClick={() => navigate(-1)} className={(current > 0 ? "text-[#888] hover:text-[#f5f1eb] hover:bg-[#1a1a1a]" : "text-[#333] cursor-default") + " text-sm px-3 py-1 rounded-lg transition-colors"} disabled={current === 0}>Prev</button>
        <div className="flex items-center gap-2">{Array.from({length: TOTAL_PAGES}, (_, i) => <button key={i} onClick={() => setCurrent(i)} className={"w-2 h-2 rounded-full transition-all duration-300 " + (i === current ? "bg-[#ff5a1f] w-4" : "bg-[#333] hover:bg-[#555]")} />)}</div>
        <div className="flex items-center gap-3"><span className="text-xs text-[#555]">{current + 1}/{TOTAL_PAGES}</span><button onClick={toggleFS} className="text-xs px-2 py-1 rounded text-[#888] hover:text-[#f5f1eb] hover:bg-[#1a1a1a] transition-colors">{fullscreen ? "Exit FS" : "Fullscreen"}</button><button onClick={() => navigate(1)} className={(current < TOTAL_PAGES - 1 ? "text-[#888] hover:text-[#f5f1eb] hover:bg-[#1a1a1a]" : "text-[#333] cursor-default") + " text-sm px-3 py-1 rounded-lg transition-colors"} disabled={current >= TOTAL_PAGES - 1}>Next</button></div>
      </div>
      {showHint && <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-xs text-[#888] animate-fadeIn">arrow keys / swipe / F fullscreen</div>}
    </div>
  );
}