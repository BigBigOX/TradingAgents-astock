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

export default function ReportSlideshow({ ticker, tickerName, tradeDate, signal, messages, report }: SlideshowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [chartLoaded, setChartLoaded] = useState(false);
  const touchX = useRef(0);
  const chartInstances = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).Chart) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';
      script.onload = () => setChartLoaded(true);
      document.head.appendChild(script);
    } else if (typeof window !== 'undefined' && (window as any).Chart) {
      setChartLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!chartLoaded) return;
    chartInstances.current.forEach(c => c?.destroy());
    chartInstances.current = [];
    const t = setTimeout(() => renderCharts(), 100);
    return () => { clearTimeout(t); chartInstances.current.forEach(c => c?.destroy()); };
  }, [chartLoaded, current, messages]);

  function renderCharts() {
    const Chart = (window as any).Chart;
    if (!Chart) return;
    const instances: any[] = [];

    const fundCanvas = document.getElementById('chart-fund-flow') as HTMLCanvasElement;
    if (fundCanvas) {
      const ctx = fundCanvas.getContext('2d');
      if (ctx) {
        const c = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['主力净流入', '大单净流入', '散户净流入'],
            datasets: [{
              label: '资金流向',
              data: [
                parseFloat(extractReg(getFromMsg(messages, 'hot_money'), /\u4e3b\u529b.*?\u51c0[\u6d41\u8fdb][\uff1a:]\s*([+-]?\d+(?:\.\d+)?)/)) || 0,
                parseFloat(extractReg(getFromMsg(messages, 'hot_money'), /\u5927\u5355.*?\u51c0[\u6d41\u8fdb][\uff1a:]\s*([+-]?\d+(?:\.\d+)?)/)) || 0,
                parseFloat(extractReg(getFromMsg(messages, 'hot_money'), /\u6563\u6237.*?\u51c0[\u6d41\u8fdb][\uff1a:]\s*([+-]?\d+(?:\.\d+)?)/)) || 0,
              ],
              backgroundColor: ['rgba(0,230,118,0.7)', 'rgba(0,229,255,0.7)', 'rgba(255,107,0,0.7)'],
              borderColor: ['#00E676', '#00E5FF', '#FF6B00'],
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
        instances.push(c);
      }
    }

    const debateCanvas = document.getElementById('chart-debate') as HTMLCanvasElement;
    if (debateCanvas) {
      const ctx = debateCanvas.getContext('2d');
      if (ctx) {
        const bull = extractScore(getFromMsg(messages, 'debate')) || 5;
        const bear = 10 - bull;
        const c = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['多方', '空方'],
            datasets: [{
              label: '多空对比',
              data: [bull, bear],
              backgroundColor: ['rgba(0,230,118,0.7)', 'rgba(255,82,82,0.7)'],
              borderColor: ['#00E676', '#FF5252'],
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
        instances.push(c);
      }
    }

    const radarCanvas = document.getElementById('chart-radar') as HTMLCanvasElement;
    if (radarCanvas) {
      const ctx = radarCanvas.getContext('2d');
      if (ctx) {
        const dims = ['market', 'fundamentals', 'policy', 'hot_money', 'social', 'lockup'];
        const scores = dims.map(d => extractScore(getFromMsg(messages, d)) || 5);
        const labels = dims.map(d => AGENT_LABELS[d]);
        const c = new Chart(ctx, {
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
        instances.push(c);
      }
    }

    chartInstances.current = instances;
  }

  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(t);
  }, [showHint]);

  useEffect(() => {
    const onFS = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFS);
    return () => document.removeEventListener('fullscreenchange', onFS);
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
      else if (e.key === 'ArrowRight') { setCurrent(p => Math.min(4, p + 1)); e.preventDefault(); }
      else if (e.key === 'f' || e.key === 'F') { toggleFS(); }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [toggleFS]);

  const rating = signal?.rating || 'hold';
  const ratingText = RATING_MAP[rating] || rating;
  const ratingTextCN = RATING_CN[rating] || rating;
  const ratingColor = RATING_COLOR[rating] || '#FFD740';
  const ratingBg = RATING_BG[rating] || 'rgba(255,215,64,0.12)';
  const isBullish = rating === 'strong_buy' || rating === 'buy';
  const isBearish = rating === 'sell' || rating === 'strong_sell';

  const agentKeys = ['market', 'social', 'hot_money', 'fundamentals', 'policy', 'lockup'];
  const agentScores = agentKeys.map(k => ({ key: k, score: extractScore(getFromMsg(messages, k)) }));

  const actionItems = isBullish
    ? [
        { role: '持有者', emoji: '\U0001F932', action: '继续持有，设好止损位即可', color: '#00E676' },
        { role: '观望者', emoji: '\U0001F440', action: '小仓位试探性介入，回调是机会', color: '#FFD740' },
        { role: '抄底者', emoji: '\U0001F985', action: '确认支撑后可适当加仓', color: '#FF6B00' },
      ]
    : isBearish
    ? [
        { role: '持有者', emoji: '\U0001F932', action: '考虑减仓锁定利润，控制风险', color: '#FF5252' },
        { role: '观望者', emoji: '\U0001F440', action: '观望为主，等待明确企稳信号', color: '#FFD740' },
        { role: '抄底者', emoji: '\U0001F985', action: '不建议盲目抄底，多看少动', color: '#888' },
      ]
    : [
        { role: '持有者', emoji: '\U0001F932', action: '谨慎持有，关注关键价位突破', color: '#FFD740' },
        { role: '观望者', emoji: '\U0001F440', action: '等待方向明确后再做决定', color: '#FFD740' },
        { role: '抄底者', emoji: '\U0001F985', action: '不建议重仓，可以小仓位试盘', color: '#FF6B00' },
      ];

  const TOTAL = 5;

  const handleTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) setCurrent(p => Math.min(TOTAL - 1, p + 1));
      else setCurrent(p => Math.max(0, p - 1));
    }
  };
  const navigate = (dir: number) => setCurrent(p => Math.max(0, Math.min(TOTAL - 1, p + dir)));


  if (!chartLoaded && typeof window !== 'undefined') {
    return (
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] p-12 text-center">
        <div className="inline-flex items-center gap-2 text-sm text-[#555]">
          <span className="w-2 h-2 bg-[#ff5a1f] rounded-full animate-pulse" />
          Loading chart library...
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] overflow-hidden select-none focus:outline-none"
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="text-center p-8 text-[#888] text-sm">
        Report Slideshow
      </div>
    </div>
  );
}
