'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = ticker.trim();
    if (!code) { setError('请输入股票代码'); return; }
    setError('');
    setLoading(true);
    const date = new Date().toISOString().slice(0, 10);
    router.push(`/analysis/${encodeURIComponent(code)}?date=${date}`);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <div className="w-full max-w-lg mx-auto">
        {/* 标题 */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="text-[#ff5a1f]">Trading</span>
            <span className="text-[#f5f1eb]">Agents</span>
          </h1>
          <p className="text-[#888] mt-3 text-sm">
            A股多 Agent 智能投研分析系统
          </p>
          <p className="text-[#555] mt-1 text-xs">
            支持 DeepSeek / OpenAI / Anthropic / 通义千问 / GLM 等模型
          </p>
        </div>

        {/* 搜索框 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={ticker}
              onChange={e => setTicker(e.target.value)}
              placeholder="输入股票代码，如 000001、贵州茅台"
              className="flex-1 p-3 bg-[#161616] border border-[#2a2a2a] rounded-lg text-[#f5f1eb] text-sm placeholder-[#555] focus:outline-none focus:border-[#ff5a1f] transition-colors"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-[#ff5a1f] to-[#ff8c42] rounded-lg text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {loading ? '跳转中...' : '开始分析'}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </form>

        {/* 使用提示 */}
        <div className="mt-8 p-4 bg-[#161616] border border-[#2a2a2a] rounded-lg">
          <h3 className="text-sm font-semibold text-[#f5f1eb] mb-2">💡 使用说明</h3>
          <ul className="text-xs text-[#888] space-y-1">
            <li>1. 先在左侧「模型设置」中配置 API Key 和模型</li>
            <li>2. 输入 A 股股票代码或名称开始分析</li>
            <li>3. 系统会调用多个 Agent 进行市场、技术、新闻、政策等全方位分析</li>
            <li>4. 最终生成包含买卖评级和置信度的综合信号</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
