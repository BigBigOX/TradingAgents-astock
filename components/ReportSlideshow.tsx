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

// ---- 中文评级体系 ----
const RATING_CN: Record<string, string> = {
  strong_buy: '重仓出击', buy: '逢低布局', hold: '静观其变',
  sell: '减仓观望', strong_sell: '果断离场',
};
const RATING_EN: Record<string, string> = {
  strong_buy: 'Strong Buy', buy: 'Buy', hold: 'Hold',
  sell: 'Sell', strong_sell: 'Strong Sell',
};
const RATING_COLOR: Record<string, string> = {
  strong_buy: '#00E676', buy: '#76FF03', hold: '#FFD740',
  sell: '#FF5252', strong_sell: '#D50000',
};
const RATING_BG: Record<string, string> = {
  strong_buy: 'rgba(0,230,118,0.15)', buy: 'rgba(118,255,3,0.12)',
  hold: 'rgba(255,215,64,0.12)', sell: 'rgba(255,82,82,0.12)',
  strong_sell: 'rgba(213,0,0,0.15)',
};
const RATING_EMOJI: Record<string, string> = {
  strong_buy: '🚀', buy: '📈', hold: '⏳', sell: '📉', strong_sell: '💀',
};

const AGENT_LABELS: Record<string, string> = {
  market: '技术面', social: '情绪面', news: '新闻面', fundamentals: '基本面',
  policy: '政策面', hot_money: '资金面', lockup: '解禁面',
};
const AGENT_ICONS: Record<string, string> = {
  market: '📉', social: '💬', news: '📰', fundamentals: '📊',
  policy: '🏛️', hot_money: '💰', lockup: '🔒',
};

// ---- 工具函数 ----
function getFromMsg(msgs: any[], agent: string): string {
  const m = msgs.find((msg: any) => msg.agent === agent);
  return m?.content || '';
}
function extractScore(content: string): number | null {
  if (!content) return null;
  const m = content.match(/(?:评分|score)[：:]\s*([0-9]+(?:\.[0-9]+)?)/i);
  return m ? parseFloat(m[1]) : null;
}
function extractReg(content: string, pattern: RegExp): string {
  if (!content) return '';
  const m = content.match(pattern);
  return m ? m[1] : '';
}
function extractOneLiner(content: string): string {
  if (!content) return '';
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  // 跳过标题行，找第一句有实际内容的
  for (const line of lines) {
    const t = line.replace(/^[-•*#>\d.]+\s*/, '').trim();
    if (t && t.length > 6 && !t.startsWith('#')) return t;
  }
  return lines[0]?.replace(/^[-•*]\s*/, '').trim() || '';
}
/** 提取"一句话说人话"：取分析报告末尾的 💡/总结行，或第一段非标题内容 */
function extractHumanReadable(content: string): string {
  if (!content) return '';
  // 优先找 💡 行
  const bulbMatch = content.match(/💡\s*[：:]\s*([^\n]+)/);
  if (bulbMatch) return bulbMatch[1].trim();
  // 找 "一句话" 行
  const oneLinerMatch = content.match(/(?:一句话|简单说|通俗说)[^：:]*[：:]\s*([^\n]+)/);
  if (oneLinerMatch) return oneLinerMatch[1].trim();
  // 最后一段非空内容（忽略标题和分隔线）
  const paras = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'));
  return paras.length > 0 ? paras[paras.length - 1].replace(/^[-•*]\s*/, '').trim() : '';
}

function extractKPI(content: string, label: string, pattern: RegExp, unit = ''): { label: string; value: string; unit: string; color?: string } {
  const v = extractReg(content, pattern);
  const isNeg = v.startsWith('-');
  return { label, value: v || '--', unit, color: isNeg ? '#FF5252' : v ? '#00E676' : '#555' };
}

/** 获取 A 股市场前缀 */
function getMarketPrefix(code: string): string {
  const c = code.trim();
  if (c.startsWith('6') || c.startsWith('9')) return 'sh';
  if (c.startsWith('0') || c.startsWith('3')) return 'sz';
  if (c.startsWith('4') || c.startsWith('8')) return 'bj';
  return 'sh';
}

/** 解析腾讯行情返回文本 */
function parseTencentQuote(raw: string): Record<string, any> | null {
  try {
    const match = raw.match(/"([^"]+)"/);
    if (!match) return null;
    const vals = match[1].split('~');
    if (vals.length < 48) return null;
    return {
      name: vals[1], price: parseFloat(vals[3]) || 0,
      lastClose: parseFloat(vals[4]) || 0, open: parseFloat(vals[5]) || 0,
      volume: parseInt(vals[6]) || 0, turnover: vals[7],
      high: parseFloat(vals[33]) || 0, low: parseFloat(vals[34]) || 0,
      changePct: parseFloat(vals[32]) || 0,
      turnoverPct: parseFloat(vals[38]) || 0,
      peTtm: parseFloat(vals[39]) || 0, mcapYi: parseFloat(vals[44]) || 0,
      floatMcapYi: parseFloat(vals[45]) || 0, pb: parseFloat(vals[46]) || 0,
      limitUp: parseFloat(vals[47]) || 0, limitDown: parseFloat(vals[48]) || 0,
    };
  } catch { return null; }
}

// ---- 主题色 ----
const THEME = {
  bg: '#0D1117',
  card: '#161B22',
  cardBorder: 'rgba(255,255,255,0.06)',
  cardHover: 'rgba(255,255,255,0.03)',
  textPrimary: '#f0f0f0',
  textSecondary: '#8b949e',
  cyan: '#00E5FF',
  orange: '#FF6B00',
  green: '#00E676',
  red: '#FF5252',
};

export default function ReportSlideshow({ ticker, tickerName, tradeDate, signal, messages }: SlideshowProps) {
  const [current, setCurrent] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [chartLoaded, setChartLoaded] = useState(false);
  const [animDir, setAnimDir] = useState<'left' | 'right'>('right');
  const [liveQuote, setLiveQuote] = useState<Record<string, any> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchX = useRef(0);
  const chartInstances = useRef<any[]>([]);
  const TOTAL_PAGES = 10;

  // 获取实时行情
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefix = getMarketPrefix(ticker);
    const url = `https://qt.gtimg.cn/q=${prefix}${ticker}`;
    fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      .then(r => r.text())
      .then(parseTencentQuote)
      .then(q => { if (q) setLiveQuote(q); })
      .catch(() => {});
  }, [ticker]);

  const marketContent = getFromMsg(messages, 'market');
  const socialContent = getFromMsg(messages, 'social');
  const hotMoneyContent = getFromMsg(messages, 'hot_money');
  const fundamentalsContent = getFromMsg(messages, 'fundamentals');
  const policyContent = getFromMsg(messages, 'policy');
  const lockupContent = getFromMsg(messages, 'lockup');

  const rating = signal?.rating || 'hold';
  const ratingTextCN = RATING_CN[rating] || rating;
  const ratingColor = RATING_COLOR[rating] || '#FFD740';
  const ratingBg = RATING_BG[rating] || 'rgba(255,215,64,0.12)';
  const ratingEmoji = RATING_EMOJI[rating] || '📊';
  const isBullish = rating === 'strong_buy' || rating === 'buy';
  const isBearish = rating === 'sell' || rating === 'strong_sell';

  const agentKeys = ['market', 'social', 'hot_money', 'fundamentals', 'policy', 'lockup'];
  const coverageDims = agentKeys.map(k => ({ key: k, score: extractScore(getFromMsg(messages, k)) }));
  const coveragePct = Math.round(coverageDims.filter(d => d.score !== null).length / coverageDims.length * 100);

  // KPI：优先实时行情数据，其次正则从LLM报告提取
  const q = liveQuote;
  const kpiItems: { label: string; value: string; unit: string; color?: string }[] = [
    { label: '最新价', value: q?.price ? q.price.toFixed(2) : extractKPI(marketContent, '收盘价', /(?:收盘价|close|price)[：:]\s*([0-9.]+)/).value, unit: '元', color: q?.changePct >= 0 ? '#00E676' : q?.changePct < 0 ? '#FF5252' : '#555' },
    { label: '涨跌幅', value: q?.changePct ? (q.changePct >= 0 ? '+' : '') + q.changePct.toFixed(2) + '%' : extractKPI(marketContent, '涨跌幅', /(?:涨跌幅|change|chg)[：:]\s*([+-]?[0-9.]+%)/).value, unit: '', color: q?.changePct >= 0 ? '#00E676' : '#FF5252' },
    { label: '成交量', value: q?.volume ? (q.volume / 100000000).toFixed(2) : extractKPI(marketContent, '成交量', /(?:成交量|volume|vol)[：:]\s*([0-9.]+)/).value, unit: '亿', color: '#00E5FF' },
    { label: '换手率', value: q?.turnoverPct ? q.turnoverPct.toFixed(2) + '%' : extractKPI(marketContent, '换手率', /(?:换手率|turnover)[：:]\s*([0-9.]+%)/).value, unit: '', color: '#FFD740' },
    { label: '市值', value: q?.mcapYi ? q.mcapYi.toFixed(0) : extractKPI(marketContent, '市值', /(?:市值|mcap|market.cap)[：:]\s*([0-9.]+)/).value, unit: '亿', color: '#FF6B00' },
  ];

  const actionItems = isBullish
    ? [{ role: '持有者', emoji: '🧲', action: '继续持有，设好止损位即可', color: '#00E676' },
       { role: '观望者', emoji: '👀', action: '小仓位试探性介入，回调是机会', color: '#FFD740' },
       { role: '想抄底', emoji: '🦅', action: '确认支撑后可适当加仓', color: '#00E5FF' }]
    : isBearish
    ? [{ role: '持有者', emoji: '🧲', action: '考虑减仓锁定利润，控制风险', color: '#FF5252' },
       { role: '观望者', emoji: '👀', action: '观望为主，等待明确企稳信号', color: '#FFD740' },
       { role: '想抄底', emoji: '🦅', action: '不建议盲目抄底，多看少动', color: '#888' }]
    : [{ role: '持有者', emoji: '🧲', action: '谨慎持有，关注关键价位突破', color: '#FFD740' },
       { role: '观望者', emoji: '👀', action: '等待方向明确后再做决定', color: '#FFD740' },
       { role: '想抄底', emoji: '🦅', action: '不建议重仓，可以小仓位试盘', color: '#FF6B00' }];

  // ---- 加载 Chart.js ----
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4';
    s.onload = () => setChartLoaded(true);
    document.head.appendChild(s);
    return () => { if (s.parentNode) document.head.removeChild(s); };
  }, []);

  // ---- 渲染图表 ----
  useEffect(() => {
    if (!chartLoaded) return;
    const C = (window as any).Chart;
    if (!C) return;
    // 销毁旧图表
    chartInstances.current.forEach(c => c.destroy());
    chartInstances.current = [];

    const inst: any[] = [];

    // 资金流向水平柱状图
    const f = document.getElementById('chart-fund') as HTMLCanvasElement;
    if (f) {
      const ctx = f.getContext('2d');
      if (ctx) {
        const c = new C(ctx, {
          type: 'bar',
          data: {
            labels: ['主力净流入', '大单净流入', '散户净流入'],
            datasets: [{
              label: '资金流向',
              data: [
                parseFloat(extractReg(getFromMsg(messages, 'hot_money'), /主力.*?净[流进][：:]\s*([+-]?[0-9]+(?:\.[0-9]+)?)/)) || 0,
                parseFloat(extractReg(getFromMsg(messages, 'hot_money'), /大单.*?净[流进][：:]\s*([+-]?[0-9]+(?:\.[0-9]+)?)/)) || 0,
                parseFloat(extractReg(getFromMsg(messages, 'hot_money'), /散户.*?净[流进][：:]\s*([+-]?[0-9]+(?:\.[0-9]+)?)/)) || 0,
              ],
              backgroundColor: ['rgba(0,230,118,0.7)', 'rgba(0,229,255,0.7)', 'rgba(255,107,0,0.7)'],
              borderColor: ['#00E676', '#00E5FF', '#FF6B00'],
              borderWidth: 1,
              borderRadius: 4,
            }],
          },
          options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e' } },
              y: { grid: { display: false }, ticks: { color: '#8b949e' } },
            },
          },
        });
        inst.push(c);
      }
    }

    // 多空对比
    const dC = document.getElementById('chart-debate') as HTMLCanvasElement;
    if (dC) {
      const ctx = dC.getContext('2d');
      if (ctx) {
        const bull = extractScore(getFromMsg(messages, 'debate')) || 5;
        const c = new C(ctx, {
          type: 'bar',
          data: {
            labels: ['多方', '空方'],
            datasets: [{
              label: '多空对比',
              data: [bull, 10 - bull],
              backgroundColor: ['rgba(0,230,118,0.7)', 'rgba(255,82,82,0.7)'],
              borderColor: ['#00E676', '#FF5252'],
              borderWidth: 2,
              borderRadius: 6,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, max: 10, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e' } },
              x: { grid: { display: false }, ticks: { color: '#8b949e' } },
            },
          },
        });
        inst.push(c);
      }
    }

    // 雷达图
    const rC = document.getElementById('chart-radar') as HTMLCanvasElement;
    if (rC) {
      const ctx = rC.getContext('2d');
      if (ctx) {
        const dims = ['market', 'fundamentals', 'policy', 'hot_money', 'social', 'lockup'];
        const scores = dims.map(d => extractScore(getFromMsg(messages, d)) || 5);
        const labels = dims.map(d => AGENT_LABELS[d]);
        const c = new C(ctx, {
          type: 'radar',
          data: {
            labels,
            datasets: [{
              label: '评分',
              data: scores,
              backgroundColor: 'rgba(0,229,255,0.12)',
              borderColor: '#00E5FF',
              borderWidth: 2,
              pointBackgroundColor: '#00E5FF',
              pointBorderColor: '#0D1117',
              pointRadius: 4,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              r: {
                beginAtZero: true, max: 10,
                grid: { color: 'rgba(255,255,255,0.06)' },
                ticks: { display: false },
                pointLabels: { color: '#8b949e', font: { size: 11 } },
              },
            },
          },
        });
        inst.push(c);
      }
    }

    chartInstances.current = inst;
  }, [chartLoaded, messages]);

  // ---- 翻页提示自动隐藏 ----
  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(t);
  }, [showHint]);

  // ---- 全屏监听 ----
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

  // ---- 窗口级键盘导航（无需点击组件即可翻页） ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { setAnimDir('left'); setCurrent(p => Math.max(0, p - 1)); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setAnimDir('right'); setCurrent(p => Math.min(TOTAL_PAGES - 1, p + 1)); e.preventDefault(); }
      else if (e.key === 'f' || e.key === 'F') { toggleFS(); e.preventDefault(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleFS]);

  // ---- 触摸滑动 ----
  const handleTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) { setAnimDir('right'); setCurrent(p => Math.min(TOTAL_PAGES - 1, p + 1)); }
      else { setAnimDir('left'); setCurrent(p => Math.max(0, p - 1)); }
    }
  };

  // ---- 加载状态 ----
  if (!chartLoaded && typeof window !== 'undefined') {
    return (
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#0D1117] p-12 text-center">
        <div className="inline-flex items-center gap-2 text-sm text-[#555]">
          <span className="w-2 h-2 bg-[#FF6B00] rounded-full animate-pulse" />
          加载图表库...
        </div>
      </div>
    );
  }

  // ---- 每页数据准备 ----
  const dimData = agentKeys.map(k => ({
    key: k, label: AGENT_LABELS[k], icon: AGENT_ICONS[k],
    score: extractScore(getFromMsg(messages, k)),
    summary: extractHumanReadable(getFromMsg(messages, k)),
    full: getFromMsg(messages, k),
  }));

  // ---- 页面定义 ----
  const pages: React.ReactNode[] = [
    // ========== 1. 封面 ==========
    <div key="c" className="flex flex-col items-center justify-center h-full p-8 text-center relative overflow-hidden">
      {/* 背景光晕 */}
      <div className="absolute w-96 h-96 rounded-full opacity-[0.03] pointer-events-none"
        style={{ background: `radial-gradient(circle, ${ratingColor} 0%, transparent 70%)`, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
      <div className="text-6xl mb-4 relative">{ratingEmoji}</div>
      {/* 评级大徽章 */}
      <div className="relative mb-6">
        <div className="text-4xl font-extrabold tracking-tight px-8 py-3 rounded-2xl"
          style={{ color: ratingColor, backgroundColor: ratingBg, border: `1px solid ${ratingColor}33`, boxShadow: `0 0 40px ${ratingColor}22` }}>
          {ratingTextCN}
        </div>
      </div>
      <div className="text-3xl font-bold text-[#f0f0f0] mb-1">{tickerName}</div>
      <div className="text-base text-[#8b949e] mb-6">
        {ticker}
        <span className="mx-2">·</span>
        {tradeDate}
      </div>
      <div className="text-sm text-[#8b949e] max-w-lg leading-relaxed">{signal?.text || '综合分析报告'}</div>
      <div className="text-xs text-[#555] mt-8">← / → 翻页 · F 全屏</div>
    </div>,

    // ========== 2. 决策仪表盘 ==========
    <div key="d" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-[#f0f0f0] mb-4 flex items-center gap-2">
        <span className="text-[#00E5FF]">◆</span> 决策仪表盘
      </div>
      {/* KPI 卡片 */}
      <div className="grid grid-cols-5 gap-2.5 mb-5">
        {kpiItems.map((k, i) => (
          <div key={i} className="rounded-xl p-3 text-center"
            style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
            <div className="text-[10px] text-[#8b949e] mb-1">{k.label}</div>
            <div className="text-lg font-bold" style={{ color: k.color || '#f0f0f0' }}>
              {k.value}
            </div>
            {k.unit && <div className="text-[10px] text-[#555]">{k.unit}</div>}
          </div>
        ))}
      </div>
      {/* 雷达图 + 覆盖度 */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-[240px]">
            <canvas id="chart-radar" height={200} />
          </div>
        </div>
        <div className="w-40 flex flex-col justify-center gap-3">
          {coverageDims.map(d => {
            const info = dimData.find(x => x.key === d.key);
            return (
              <div key={d.key} className="flex items-center gap-2">
                <span className="text-sm shrink-0">{info?.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-[#8b949e]">{info?.label}</span>
                    <span style={{ color: d.score !== null ? '#00E5FF' : '#555' }}>
                      {d.score !== null ? d.score + '/10' : '--'}
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: THEME.cardBorder }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: d.score !== null ? (d.score! / 10 * 100) + '%' : '0%', background: `linear-gradient(90deg, ${THEME.cyan}, ${THEME.green})` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* 数据覆盖度 */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-[#8b949e] mb-1">
          <span>数据覆盖度</span>
          <span>{coveragePct}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: THEME.cardBorder }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: coveragePct + '%', background: `linear-gradient(90deg, ${THEME.cyan}, ${THEME.orange})` }} />
        </div>
      </div>
    </div>,

    // ========== 3. 资金流向 ==========
    <div key="f" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-[#f0f0f0] mb-4 flex items-center gap-2">
        <span className="text-[#FF6B00]">◆</span> 资金流向分析
      </div>
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 flex items-center">
          <canvas id="chart-fund" height={180} />
        </div>
        <div className="w-44 flex flex-col justify-center gap-3">
          {hotMoneyContent && (
            <div className="rounded-xl p-4" style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
              <div className="text-xs text-[#8b949e] mb-2">💡 一句话说人话</div>
              <div className="text-sm text-[#f0f0f0] leading-relaxed font-medium">
                {extractHumanReadable(hotMoneyContent) || '暂无资金数据'}
              </div>
            </div>
          )}
          {!hotMoneyContent && (
            <div className="text-xs text-[#555] text-center">暂无资金数据</div>
          )}
        </div>
      </div>
      <div className="mt-3 text-[10px] text-[#555] text-center">主力 / 大单 / 散户资金净流入（万元）</div>
    </div>,

    // ========== 4. 多空对决 ==========
    <div key="db" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-[#f0f0f0] mb-4 flex items-center gap-2">
        <span className="text-[#00E676]">◆</span> 多空对决
      </div>
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 flex items-center">
          <canvas id="chart-debate" height={160} />
        </div>
        <div className="w-36 flex flex-col justify-center gap-3">
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
            <div className="text-xs text-[#8b949e] mb-1">情绪面</div>
            <div className="text-xl font-bold text-[#00E676]">
              {extractScore(socialContent) !== null ? extractScore(socialContent) + '/10' : '--'}
            </div>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
            <div className="text-xs text-[#8b949e] mb-1">资金面</div>
            <div className="text-xl font-bold text-[#00E5FF]">
              {extractScore(hotMoneyContent) !== null ? extractScore(hotMoneyContent) + '/10' : '--'}
            </div>
          </div>
        </div>
      </div>
      {socialContent && (
        <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
          <div className="text-xs text-[#8b949e] mb-1">💡 情绪解读</div>
          <div className="text-xs text-[#f0f0f0] leading-relaxed">{extractHumanReadable(socialContent) || extractOneLiner(socialContent)}</div>
        </div>
      )}
    </div>,

    // ========== 5. 基本面风险 ==========
    <div key="fd" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-[#f0f0f0] mb-4 flex items-center gap-2">
        <span className={isBearish ? 'text-[#FF5252]' : 'text-[#FFD740]'}>◆</span> 基本面分析
      </div>
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {fundamentalsContent && (
          <>
            {/* 风险警示卡（如有风险） */}
            {fundamentalsContent.match(/(?:风险|亏损|下降|减少|预警|警示|注意)/) && (
              <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔴</span>
                  <span className="text-sm font-bold text-[#FF5252]">风险提示</span>
                </div>
                <div className="text-xs text-[#f0f0f0] leading-relaxed">
                  {extractReg(fundamentalsContent, /(?:风险|注意)[：:].*?(?:[。\n]|$)/) || '基本面存在不确定性，请关注详细分析'}
                </div>
              </div>
            )}
            <div className="rounded-xl p-4 flex-1" style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
              <div className="text-xs text-[#8b949e] mb-2">📊 核心数据</div>
              <div className="text-xs text-[#f0f0f0] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {extractOneLiner(fundamentalsContent)}
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
              <div className="text-xs text-[#8b949e] mb-1">💡 一句话说人话</div>
              <div className="text-sm text-[#f0f0f0] font-medium">{extractHumanReadable(fundamentalsContent)}</div>
            </div>
          </>
        )}
        {!fundamentalsContent && (
          <div className="flex-1 flex items-center justify-center text-xs text-[#555]">暂无基本面数据</div>
        )}
      </div>
    </div>,

    // ========== 6. 政策面 ==========
    <div key="p" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-[#f0f0f0] mb-4 flex items-center gap-2">
        <span className="text-[#00E5FF]">◆</span> 政策面分析
      </div>
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {policyContent && (
          <>
            <div className="rounded-xl p-4 flex-1" style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
              <div className="text-xs text-[#8b949e] mb-2">🏛️ 政策要点</div>
              <div className="text-xs text-[#f0f0f0] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {extractOneLiner(policyContent)}
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
              <div className="text-xs text-[#8b949e] mb-1">💡 一句话说人话</div>
              <div className="text-sm text-[#f0f0f0] font-medium">{extractHumanReadable(policyContent)}</div>
            </div>
          </>
        )}
        {!policyContent && (
          <div className="flex-1 flex items-center justify-center text-xs text-[#555]">暂无政策面数据</div>
        )}
      </div>
    </div>,

    // ========== 7. 情绪+技术面 ==========
    <div key="st" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-[#f0f0f0] mb-4 flex items-center gap-2">
        <span className="text-[#FF6B00]">◆</span> 情绪 &amp; 技术面
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        {/* 情绪面 */}
        <div className="rounded-xl p-4 flex flex-col" style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
          <div className="text-sm font-bold text-[#f0f0f0] mb-3">💬 情绪面</div>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 text-center p-2 rounded-lg" style={{ backgroundColor: THEME.bg }}>
              <div className="text-[10px] text-[#8b949e]">情绪评分</div>
              <div className="text-xl font-bold text-[#00E5FF]">
                {extractScore(socialContent) !== null ? extractScore(socialContent) : '--'}
              </div>
            </div>
            <div className="flex-1 text-center p-2 rounded-lg" style={{ backgroundColor: THEME.bg }}>
              <div className="text-[10px] text-[#8b949e]">市场热度</div>
              <div className="text-xl font-bold text-[#FF6B00]">
                {extractScore(marketContent) !== null ? extractScore(marketContent) : '--'}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto text-xs text-[#f0f0f0] leading-relaxed">
            {extractHumanReadable(socialContent) || extractOneLiner(socialContent) || '暂无数据'}
          </div>
        </div>
        {/* 技术面 */}
        <div className="rounded-xl p-4 flex flex-col" style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
          <div className="text-sm font-bold text-[#f0f0f0] mb-3">📉 技术面</div>
          <div className="flex-1 overflow-y-auto text-xs text-[#f0f0f0] leading-relaxed">
            {marketContent ? (
              <>
                <div className="mb-2 p-2 rounded-lg" style={{ backgroundColor: THEME.bg }}>
                  <div className="text-[#8b949e] mb-1">近期走势</div>
                  {extractOneLiner(marketContent)}
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: THEME.bg }}>
                  <div className="text-[#8b949e] mb-1">💡 一句话说人话</div>
                  <div className="font-medium">{extractHumanReadable(marketContent)}</div>
                </div>
              </>
            ) : '暂无技术数据'}
          </div>
        </div>
      </div>
    </div>,

    // ========== 8. 维度总览（新增） ==========
    <div key="ov" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-[#f0f0f0] mb-4 flex items-center gap-2">
        <span className="text-[#00E5FF]">◆</span> 多维度分析总览
      </div>
      <div className="flex-1 grid grid-cols-2 gap-2.5 overflow-y-auto content-start">
        {dimData.map(d => {
          const hasData = d.score !== null;
          return (
            <div key={d.key} className="rounded-xl p-3"
              style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{d.icon}</span>
                  <span className="text-xs font-bold text-[#f0f0f0]">{d.label}</span>
                </div>
                {hasData && (
                  <span className="text-sm font-bold" style={{ color: d.score! >= 6 ? '#00E676' : d.score! >= 4 ? '#FFD740' : '#FF5252' }}>
                    {d.score}/10
                  </span>
                )}
                {!hasData && <span className="text-[10px] text-[#555]">暂无评分</span>}
              </div>
              {/* 评分条 */}
              <div className="h-1 rounded-full mb-2 overflow-hidden" style={{ backgroundColor: THEME.cardBorder }}>
                {hasData && (
                  <div className="h-full rounded-full transition-all"
                    style={{ width: (d.score! / 10 * 100) + '%', background: d.score! >= 6 ? `linear-gradient(90deg, ${THEME.cyan}, ${THEME.green})` : d.score! >= 4 ? `linear-gradient(90deg, #FFD740, ${THEME.orange})` : `linear-gradient(90deg, ${THEME.orange}, ${THEME.red})` }} />
                )}
              </div>
              <div className="text-[10px] text-[#8b949e] leading-relaxed line-clamp-3">
                {d.summary || (hasData ? '分析完成，查看详细报告' : '数据不足')}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[10px] text-[#555] text-center">共 {dimData.filter(d => d.score !== null).length}/{dimData.length} 个维度有评分</div>
    </div>,

    // ========== 9. 行动指南 ==========
    <div key="a" className="flex flex-col h-full p-6">
      <div className="text-lg font-bold text-[#f0f0f0] mb-4 flex items-center gap-2">
        <span className="text-[#00E5FF]">◆</span> 行动指南
      </div>
      <div className="flex-1 grid grid-cols-3 gap-3 min-h-0">
        {actionItems.map((item, i) => (
          <div key={i} className="rounded-xl p-5 flex flex-col items-center justify-center text-center"
            style={{
              backgroundColor: item.color + '08',
              border: `1px solid ${item.color}30`,
            }}>
            <div className="text-3xl mb-3">{item.emoji}</div>
            <div className="text-sm font-bold mb-2" style={{ color: item.color }}>{item.role}</div>
            <div className="text-xs text-[#ccc] leading-relaxed">{item.action}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl p-3 text-center" style={{ backgroundColor: THEME.card, border: `1px solid ${THEME.cardBorder}` }}>
        <div className="text-[10px] text-[#555]">本报告仅供参考，不构成投资建议</div>
      </div>
    </div>,

    // ========== 10. 总结 ==========
    <div key="su" className="flex flex-col items-center justify-center h-full p-8 text-center relative overflow-hidden">
      <div className="absolute w-80 h-80 rounded-full opacity-[0.02] pointer-events-none"
        style={{ background: `radial-gradient(circle, ${ratingColor} 0%, transparent 70%)`, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
      <div className="text-5xl mb-4 relative">{ratingEmoji}</div>
      <div className="text-2xl font-bold text-[#f0f0f0] mb-2">综合评级</div>
      <div className="inline-block text-2xl font-extrabold px-8 py-3 rounded-2xl mb-4"
        style={{ color: ratingColor, backgroundColor: ratingBg, border: `1px solid ${ratingColor}33` }}>
        {ratingTextCN}
      </div>
      <div className="text-sm text-[#8b949e] mb-6">
        {tickerName}（{ticker}）· {tradeDate}
      </div>
      <div className="text-xs text-[#555] max-w-md leading-relaxed">
        {signal?.text || '多 Agent 智能投研分析完成'}
      </div>
      <div className="text-[10px] text-[#555] mt-8">数据来源: A股多代理分析 | TradingAgents</div>
    </div>,
  ];

  // ---- 渲染 ----
  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden select-none focus:outline-none"
      style={{ backgroundColor: THEME.bg, border: `1px solid ${THEME.cardBorder}`, minHeight: '520px' }}
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}>
      {/* 顶部栏 */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2.5"
        style={{ background: `linear-gradient(180deg, ${THEME.bg} 0%, transparent 100%)` }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: ratingBg, color: ratingColor }}>
            {ratingTextCN}
          </span>
          <span className="text-[10px] text-[#555]">
            {current + 1} / {TOTAL_PAGES}
          </span>
        </div>
        <button onClick={toggleFS}
          className="text-[10px] text-[#555] hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5">
          {fullscreen ? '退出全屏' : '⛶ 全屏'}
        </button>
      </div>
      {/* 幻灯片 */}
      <div className="w-full transition-all duration-300" style={{ height: '520px' }}>
        <div
          key={current}
          className="w-full h-full animate-fadeIn"
          style={{ animation: 'slideIn 0.3s ease-out' }}>
          {pages[current]}
        </div>
      </div>
      {/* 底部导航点 */}
      <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5">
        {pages.map((_, i) => (
          <button key={i} onClick={() => { setAnimDir(i > current ? 'right' : 'left'); setCurrent(i); }}
            className="w-1.5 h-1.5 rounded-full transition-all duration-200"
            style={{ backgroundColor: i === current ? ratingColor : '#333', transform: i === current ? 'scale(1.4)' : 'scale(1)' }} />
        ))}
      </div>
      {/* 翻页提示 */}
      {showHint && (
        <div className="absolute bottom-8 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="px-4 py-2 rounded-full text-[10px] text-[#555] backdrop-blur-sm"
            style={{ backgroundColor: 'rgba(22,27,34,0.9)', border: `1px solid ${THEME.cardBorder}` }}>
            ← → 翻页 · F 全屏
          </div>
        </div>
      )}
      {/* 全局动画 */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(${animDir === 'right' ? '20px' : '-20px'}); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
