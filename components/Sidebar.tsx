'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Settings } from './Settings'

interface HistoryEntry {
  ticker: string
  date: string
  signal?: string
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
    <aside className="fixed left-0 top-0 w-80 h-full bg-[#0f0f0f] border-r border-[#1a1a1a] overflow-y-auto z-50">
      {/* Logo */}
      <div className="text-center py-6 border-b border-[#1a1a1a]">
        <div className="text-2xl font-extrabold">
          <span className="text-[#ff5a1f]">Trading</span>
          <span className="text-[#f5f1eb]">Agents</span>
          <span className="text-[#ff5a1f]">-Astock</span>
        </div>
        <div className="text-sm text-[#888] mt-1">A股多Agent投研系统</div>
      </div>

      {/* 新建分析按钮 */}
      <div className="p-4">
        <Link
          href="/"
          className="block w-full py-2 px-4 bg-[#161616] border border-[#2a2a2a] rounded-lg text-center text-[#f5f1eb] hover:border-[#ff5a1f] transition-colors"
        >
          新建分析
        </Link>
      </div>

      {/* 模型设置按钮 */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full py-2 px-4 bg-[#161616] border border-[#2a2a2a] rounded-lg text-sm text-[#888] hover:border-[#ff5a1f] transition-colors"
        >
          {showSettings ? '收起设置' : '模型设置'}
        </button>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="px-4 mb-4">
          <Settings />
        </div>
      )}

      {/* 历史记录 */}
      <div className="px-4">
        <h3 className="text-sm text-[#888] mb-2 font-semibold">历史记录</h3>
        {history.length === 0 ? (
          <p className="text-xs text-[#555]">暂无历史记录</p>
        ) : (
          <div className="space-y-1">
            {history.map((entry, i) => (
              <Link
                key={i}
                href={`/analysis/${encodeURIComponent(entry.ticker)}?date=${entry.date}`}
                className="block py-2 px-3 text-sm text-[#ccc] bg-[#161616] rounded-lg hover:border-[#ff5a1f] border border-transparent transition-colors"
              >
                <span className="font-medium">{entry.ticker}</span>
                <span className="text-[#555] text-xs ml-2">{entry.date}</span>
                {entry.signal && (
                  <span className="text-[#888] text-xs block truncate mt-0.5">{entry.signal}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 底部 */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#1a1a1a]">
        <p className="text-xs text-[#555] text-center">仅供学习研究，不构成投资建议</p>
      </div>
    </aside>
  )
}