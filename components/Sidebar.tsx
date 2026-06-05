'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Settings } from './Settings'

interface HistoryEntry {
  id?: string
  ticker: string
  tickerName?: string
  tradeDate: string
  signal?: string
  status?: string
}

export function Sidebar() {
  const [showSettings, setShowSettings] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    fetch('/api/history')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setHistory(data)
        else if (data.history && Array.isArray(data.history)) setHistory(data.history)
      })
      .catch(() => {})
  }, [])

  return (
    <aside className="fixed left-0 top-0 w-80 h-full bg-[#0f0f0f] border-r border-[#1a1a1a] z-50 flex flex-col">
      {/* Logo */}
      <div className="text-center py-6 border-b border-[#1a1a1a] shrink-0">
        <div className="text-2xl font-extrabold">
          <span className="text-[#ff5a1f]">Trading</span>
          <span className="text-[#f5f1eb]">Agents</span>
          <span className="text-[#ff5a1f]">-Astock</span>
        </div>
        <div className="text-sm text-[#888] mt-1">A股多Agent投研系统</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <Link href="/"
            className="block w-full py-2 px-4 bg-[#161616] border border-[#2a2a2a] rounded-lg text-center text-[#f5f1eb] hover:border-[#ff5a1f] transition-colors">
            新建分析
          </Link>
        </div>

        <div className="px-4 mb-4">
          <button onClick={() => setShowSettings(!showSettings)}
            className="w-full py-2 px-4 bg-[#161616] border border-[#2a2a2a] rounded-lg text-sm text-[#888] hover:border-[#ff5a1f] transition-colors">
            {showSettings ? "收起设置" : "模型设置"}
          </button>
        </div>

        {showSettings && <div className="px-4 mb-4"><Settings /></div>}

        <div className="px-4 pb-24">
          <h3 className="text-sm text-[#888] mb-2 font-semibold">历史记录</h3>
          {history.length === 0 ? (
            <p className="text-xs text-[#555]">暂无历史记录</p>
          ) : (
            <div className="space-y-1">
              {history.map((entry, i) => (
                <div key={i} className="group relative flex items-start bg-[#161616] rounded-lg hover:border-[#ff5a1f] border border-transparent transition-colors">
                  <Link
                    href={"/analysis/" + encodeURIComponent(entry.ticker) + "?date=" + entry.tradeDate + (entry.id ? "&taskId=" + entry.id : "")}
                    className="flex-1 py-2 px-3 text-sm text-[#ccc] min-w-0">
                    <span className="font-medium">{entry.tickerName || entry.ticker}</span>
                    {entry.tickerName && entry.tickerName !== entry.ticker && <span className="text-[#888] text-xs ml-1.5">{entry.ticker}</span>}
                    <span className="text-[#555] text-xs ml-2">{entry.tradeDate}</span>
                    {entry.signal && (
                      <span className="text-[#888] text-xs truncate mt-0.5 block" style={{maxWidth: "240px"}}>{entry.signal}</span>
                    )}
                    {entry.status === 'recycled' && <span className="text-[#555] text-[10px] block mt-0.5">已归档</span>}
                  </Link>
                  <button
                    onClick={async (e) => {
                      e.preventDefault()
                      if (!entry.id) return
                      if (!confirm('确认删除这条分析记录？')) return
                      try {
                        await fetch('/api/history?id=' + entry.id, { method: 'DELETE' })
                        setHistory(prev => prev.filter(h => h.id !== entry.id))
                      } catch {}
                    }}
                    className="shrink-0 px-2 py-2 text-[#555] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="删除">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 p-4 border-t border-[#1a1a1a]">
        <p className="text-xs text-[#555] text-center">仅供学习研究，不构成投资建议</p>
      </div>
    </aside>
  )
}