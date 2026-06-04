'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface SlideshowProps {
  ticker: string;
  tickerName: string;
  tradeDate: string;
  signal?: { text: string; rating?: string; confidence?: number } | null;
  messages: { id: string; agent: string; label: string; side?: string; content: string; round?: number }[];
  report: string;
}

const AGENT_ICONS: Record<string,string> = { market:'📉',social:'💬',news:'📰',fundamentals:'📊',policy:'🏛️',hot_money:'💰',lockup:'🔒',quality_gate:'✅',research_manager:'📋',trader:'💹',pm:'📦' };
const AGENT_LABELS: Record<string,string> = { market:'市场分析',social:'情绪分析',news:'新闻分析',fundamentals:'基本面分析',policy:'政策分析',hot_money:'资金分析',lockup:'解禁分析',quality_gate:'质量门控',research_manager:'研究主管',trader:'交易决策',pm:'投资组合' };
const RATING_MAP: Record<string,string> = { strong_buy:'Strong Buy',buy:'Buy',hold:'Hold',sell:'Sell',strong_sell:'Strong Sell' };
const RATING_CN: Record<string,string> = { strong_buy:'强烈建议买入',buy:'建议买入',hold:'持有观望',sell:'建议卖出',strong_sell:'强烈建议卖出' };
const RATING_COLOR: Record<string,string> = { strong_buy:'#00E676',buy:'#76FF03',hold:'#FFD740',sell:'#FF5252',strong_sell:'#D50000' };
const RATING_BG: Record<string,string> = { strong_buy:'rgba(0,230,118,0.15)',buy:'rgba(118,255,3,0.12)',hold:'rgba(255,215,64,0.12)',sell:'rgba(255,82,82,0.12)',strong_sell:'rgba(213,0,0,0.15)' };

function getFromMsg(messages:any[],agent:string):string{const m=messages.find((msg:any)=>msg.agent===agent);return m?.content||''}
function extractScore(content:string):number|null{if(!content)return null;const m=content.match(/(?:评分|score)[：:]\s*([0-9]+(?:\.[0-9]+)?)/i);return m?parseFloat(m[1]):null}
function extractReg(content:string,pattern:RegExp):string{if(!content)return '';const m=content.match(pattern);return m?m[1]:''}
function extractOneLiner(content:string):string{if(!content)return '';const lines=content.split('\n').filter(l=>l.trim().length>0);return lines.length>0?lines[0].replace(/^[-•*]\s*/,'').trim():''}
function extractKPI(content:string,label:string,pattern:RegExp):{label:string;value:string;color?:string}{const v=extractReg(content,pattern);const isNeg=v.startsWith('-');return{label,value:v||'--',color:isNeg?'#FF5252':v?'#00E676':'#888'}}

export default function ReportSlideshow({ ticker, tickerName, tradeDate, signal, messages, report }: SlideshowProps) {
  const [current, setCurrent] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [chartLoaded, setChartLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchX = useRef(0);
  const chartInstances = useRef<any[]>([]);
  const TOTAL_PAGES = 10;

  const marketContent = getFromMsg(messages, 'market');
  const socialContent = getFromMsg(messages, 'social');
  const hotMoneyContent = getFromMsg(messages, 'hot_money');
  const rating = signal?.rating || 'hold';
  const ratingTextCN = RATING_CN[rating] || rating;
  const ratingColor = RATING_COLOR[rating] || '#FFD740';
  const ratingBg = RATING_BG[rating] || 'rgba(255,215,64,0.12)';
  const isBullish = rating === 'strong_buy' || rating === 'buy';
  const isBearish = rating === 'sell' || rating === 'strong_sell';
  const agentKeys = ['market','social','hot_money','fundamentals','policy','lockup'];
  const coverageDims = agentKeys.map(k=>({key:k,score:extractScore(getFromMsg(messages,k))}));
  const coveragePct = Math.round(coverageDims.filter(d=>d.score!==null).length/coverageDims.length*100);
  const kpiItems:{label:string;value:string;color?:string}[] = [
    extractKPI(marketContent,'收盘价',/(?:收盘价|close|price)[：:]\s*([0-9.]+)/),
    extractKPI(marketContent,'涨跌幅',/(?:涨跌幅|change|chg)[：:]\s*([+-]?[0-9.]+%)/),
    extractKPI(marketContent,'成交量',/(?:成交量|volume|vol)[：:]\s*([0-9.]+)/),
    extractKPI(marketContent,'换手率',/(?:换手率|turnover)[：:]\s*([0-9.]+%)/),
  ];
  const actionItems = isBullish
    ? [{role:'持有者',emoji:'🧲',action:'继续持有，设好止损位即可',color:'#00E676'},{role:'观望者',emoji:'👀',action:'小仓位试探性介入，回调是机会',color:'#FFD740'},{role:'抄底者',emoji:'🦅',action:'确认支撑后可适当加仓',color:'#FF6B00'}]
    : isBearish
    ? [{role:'持有者',emoji:'🧲',action:'考虑减仓锁定利润，控制风险',color:'#FF5252'},{role:'观望者',emoji:'👀',action:'观望为主，等待明确企稳信号',color:'#FFD740'},{role:'抄底者',emoji:'🦅',action:'不建议盲目抄底，多看少动',color:'#888'}]
    : [{role:'持有者',emoji:'🧲',action:'谨慎持有，关注关键价位突破',color:'#FFD740'},{role:'观望者',emoji:'👀',action:'等待方向明确后再做决定',color:'#FFD740'},{role:'抄底者',emoji:'🦅',action:'不建议重仓，可以小仓位试盘',color:'#FF6B00'}]

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4';
    s.onload = () => setChartLoaded(true);
    document.head.appendChild(s);
    return () => { if (s.parentNode) document.head.removeChild(s); };
  }, []);

  useEffect(() => {
    if (!chartLoaded) return;
    const C = (window as any).Chart;
    if (!C) return;
    const inst: any[] = [];
    const f = document.getElementById('chart-fund') as HTMLCanvasElement;
    if (f) {
      const ctx = f.getContext('2d');
      if (ctx) {
        const c = new C(ctx, {
          type: 'bar',
          data: {
            labels: ['主力净流入','大单净流入','散户净流入'],
            datasets: [{
              label: '资金流向',
              data: [
                parseFloat(extractReg(getFromMsg(messages,'hot_money'),/主力.*?净[流进][：:]\s*([+-]?[0-9]+(?:\.[0-9]+)?)/)) || 0,
                parseFloat(extractReg(getFromMsg(messages,'hot_money'),/大单.*?净[流进][：:]\s*([+-]?[0-9]+(?:\.[0-9]+)?)/)) || 0,
                parseFloat(extractReg(getFromMsg(messages,'hot_money'),/散户.*?净[流进][：:]\s*([+-]?[0-9]+(?:\.[0-9]+)?)/)) || 0,
              ],
              backgroundColor: ['rgba(0,230,118,0.7)','rgba(0,229,255,0.7)','rgba(255,107,0,0.7)'],
              borderColor: ['#00E676','#00E5FF','#FF6B00'],
              borderWidth: 1,
            }],
          },
          options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
              y: { grid: { display: false }, ticks: { color: '#888' } },
            },
          },
        });
        inst.push(c);
      }
    }
    const dC = document.getElementById('chart-debate') as HTMLCanvasElement;
    if (dC) {
      const ctx = dC.getContext('2d');
      if (ctx) {
        const bull = extractScore(getFromMsg(messages,'debate')) || 5;
        const c = new C(ctx, {
          type: 'bar',
          data: {
            labels: ['多方','空方'],
            datasets: [{
              label: '多空对比',
              data: [bull, 10 - bull],
              backgroundColor: ['rgba(0,230,118,0.7)','rgba(255,82,82,0.7)'],
              borderColor: ['#00E676','#FF5252'],
              borderWidth: 2,
              borderRadius: 4,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, max: 10, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
              x: { grid: { display: false }, ticks: { color: '#888' } },
            },
          },
        });
        inst.push(c);
      }
    }
    const rC = document.getElementById('chart-radar') as HTMLCanvasElement;
    if (rC) {
      const ctx = rC.getContext('2d');
      if (ctx) {
        const dims = ['market','fundamentals','policy','hot_money','social','lockup'];
        const scores = dims.map(d=>extractScore(getFromMsg(messages,d))||5);
        const labels = dims.map(d=>AGENT_LABELS[d]);
        const c = new C(ctx, {
          type: 'radar',
          data: {
            labels,
            datasets: [{
              label: '评分',
              data: scores,
              backgroundColor: 'rgba(0,229,255,0.15)',
              borderColor: '#00E5FF',
              borderWidth: 2,
              pointBackgroundColor: '#00E5FF',
              pointBorderColor: '#fff',
              pointRadius: 4,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              r: {
                beginAtZero: true, max: 10,
                grid: { color: 'rgba(255,255,255,0.08)' },
                ticks: { display: false },
                pointLabels: { color: '#888', font: { size: 10 } },
              },
            },
          },
        });
        inst.push(c);
      }
    }
    chartInstances.current = inst;
  }, [chartLoaded, messages]);

  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(t);
  }, [showHint]);
  useEffect(() => {
    const f = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  const toggleFS = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) { await el.requestFullscreen(); }
    else { await document.exitFullscreen(); }
  }, []);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { setCurrent(p => Math.max(0, p - 1)); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setCurrent(p => Math.min(TOTAL_PAGES - 1, p + 1)); e.preventDefault(); }
      else if (e.key === 'f' || e.key === 'F') { toggleFS(); }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [toggleFS]);
  const handleTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) setCurrent(p => Math.min(TOTAL_PAGES - 1, p + 1));
      else setCurrent(p => Math.max(0, p - 1));
    }
  };

  if (!chartLoaded && typeof window !== 'undefined') {
    return (
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] p-12 text-center">
        <div className="inline-flex items-center gap-2 text-sm text-[#555]">
          <span className="w-2 h-2 bg-[#ff5a1f] rounded-full animate-pulse" />
          加载图表库...
        </div>
      </div>
    );
  }

  const pages: React.ReactNode[] = [
    // 1: 封面
    <div key="c" className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="text-5xl mb-4">{isBullish ? '📈' : isBearish ? '📉' : '📊'}</div>
      <div className="text-3xl font-bold text-white mb-2">{ticker} {tickerName}</div>
      <div className="text-sm text-[#555] mb-6">{tradeDate}</div>
      <div className="inline-block px-6 py-2 rounded-full text-lg font-bold mb-4" style={{backgroundColor: ratingBg, color: ratingColor}}>{ratingTextCN}</div>
      <div className="text-lg text-[#aaa] max-w-lg">{signal?.text || '综合分析报告'}</div>
    </div>,
    // 2: 仪表盘
    <div key="d" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-white mb-4">精决策仪表盘</div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        {kpiItems.map((k,i)=>(
          <div key={i} className="bg-[#1a1a1a] rounded-xl p-4 text-center border border-[#2a2a2a]">
            <div className="text-xs text-[#555] mb-1">{k.label}</div>
            <div className="text-xl font-bold" style={{color: k.color || '#fff'}}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-sm text-[#555] mb-3 text-center">多维度评分分布</div>
          <canvas id="chart-radar" height={240} />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-xs text-[#555] mb-2">数据覆盖度</div>
        <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{width: coveragePct + '%', background: 'linear-gradient(90deg, #00E5FF, #00E676)'}} />
        </div>
        <div className="text-right text-xs text-[#555] mt-1">{coveragePct}%</div>
      </div>
    </div>,
    // 3: 资金流向
    <div key="f" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-white mb-4">资金流向</div>
      <div className="flex-1"><canvas id="chart-fund" height={200} /></div>
      <div className="mt-4 p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
        <div className="text-sm text-[#888]">{extractOneLiner(hotMoneyContent) || '暂无资金数据'}</div>
      </div>
    </div>,
    // 4: 多空对决
    <div key="db" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-white mb-4">多空对决</div>
      <div className="flex-1"><canvas id="chart-debate" height={200} /></div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] text-center">
          <div className="text-xs text-[#555] mb-1">情绪面</div>
          <div className="text-lg font-bold text-[#00E676]">{extractScore(socialContent) !== null ? extractScore(socialContent) + '/10' : '--'}</div>
        </div>
        <div className="p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] text-center">
          <div className="text-xs text-[#555] mb-1">资金面</div>
          <div className="text-lg font-bold text-[#00E5FF]">{extractScore(hotMoneyContent) !== null ? extractScore(hotMoneyContent) + '/10' : '--'}</div>
        </div>
      </div>
    </div>,
    // 5: 基本面
    <div key="fd" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-white mb-4">基本面分析</div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
          <div className="text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap">{extractOneLiner(getFromMsg(messages,'fundamentals')) || '基本面数据暂无'}</div>
        </div>
      </div>
    </div>,
    // 6: 政策面
    <div key="p" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-white mb-4">政策面分析</div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
          <div className="text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap">{extractOneLiner(getFromMsg(messages,'policy')) || '政策面数据暂无'}</div>
        </div>
      </div>
    </div>,
    // 7: 情绪面
    <div key="s" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-white mb-4">情绪面分析</div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] text-center">
          <div className="text-xs text-[#555] mb-1">情绪评分</div>
          <div className="text-2xl font-bold text-[#00E5FF]">{extractScore(socialContent) !== null ? extractScore(socialContent) : '--'}</div>
          <div className="text-[10px] text-[#555] mt-1">/10</div>
        </div>
        <div className="p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] text-center">
          <div className="text-xs text-[#555] mb-1">市场热度</div>
          <div className="text-2xl font-bold text-[#FF6B00]">{extractScore(marketContent) !== null ? extractScore(marketContent) : '--'}</div>
          <div className="text-[10px] text-[#555] mt-1">/10</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
          <div className="text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap">{extractOneLiner(socialContent) || '情绪数据暂无'}</div>
        </div>
      </div>
    </div>,
    // 8: 技术面
    <div key="m" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-white mb-4">市场技术面</div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] mb-3">
          <div className="text-xs text-[#555] mb-2">技术指标总结</div>
          <div className="text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap">{extractOneLiner(marketContent) || '市场技术数据暂无'}</div>
        </div>
      </div>
    </div>,
    // 9: 行动指南
    <div key="a" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-white mb-4">行动指南</div>
      <div className="flex-1 space-y-3">
        {actionItems.map((item,i)=>(
          <div key={i} className="p-4 rounded-xl border" style={{backgroundColor: item.color + '12', borderColor: item.color + '40'}}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{item.emoji}</span>
              <span className="font-bold text-sm" style={{color: item.color}}>{item.role}</span>
            </div>
            <div className="text-sm text-[#ccc] ml-7">{item.action}</div>
          </div>
        ))}
      </div>
    </div>,
    // 10: 总结
    <div key="su" className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="text-4xl mb-3">{isBullish ? '🟢' : isBearish ? '🔴' : '🟡'}</div>
      <div className="text-xl font-bold text-white mb-4">总结</div>
      <div className="inline-block px-6 py-2 rounded-full text-lg font-bold mb-4" style={{backgroundColor: ratingBg, color: ratingColor}}>{ratingTextCN}</div>
      <div className="text-sm text-[#aaa] max-w-md mb-6">{ticker} ({tickerName}) 综合评级</div>
      <div className="text-xs text-[#555]">数据来源: A股多代理分析 | {tradeDate}</div>
    </div>,
  ];

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] overflow-hidden select-none focus:outline-none"
      style={{ minHeight: '500px' }}
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}>
      {/* 顶部栏 */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-[#0f0f0f] to-transparent">
        <div className="text-xs text-[#555]">{current + 1} / {TOTAL_PAGES}</div>
        <button onClick={toggleFS} className="text-xs text-[#555] hover:text-white transition-colors px-2 py-1 rounded hover:bg-[#2a2a2a]">
          {fullscreen ? '退出全屏' : '□ 全屏'}
        </button>
      </div>
      {/* 幻灯片内容 */}
      <div className="w-full" style={{ height: '500px' }}>
        <div className="w-full h-full transition-all duration-300">{pages[current]}</div>
      </div>
      {/* 底部导航点 */}
      <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5">
        {pages.map((_,i)=>(
          <button key={i} onClick={()=>setCurrent(i)}
            className="w-1.5 h-1.5 rounded-full transition-all"
            style={{backgroundColor: i === current ? ratingColor : '#333'}} />
        ))}
      </div>
      {/* 翻页提示 */}
      {showHint && (
        <div className="absolute bottom-8 left-0 right-0 z-30 flex justify-center animate-fade-out">
          <div className="px-4 py-2 rounded-full bg-[#1a1a1a] text-[10px] text-[#555] border border-[#2a2a2a]">
            ← → 翻页 | F 全屏
          </div>
        </div>
      )}
    </div>
  );
}