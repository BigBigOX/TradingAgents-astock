/**
 * 分析结果页面
 */

'use client'

import { useState, useEffect, use } from 'react'
import { parseRating } from '../../../src/schemas'

interface PageProps {
  params: Promise<{ ticker: string }>
  searchParams: Promise<{ date?: string }>
}

interface StageInfo {
  id: string
  label: string
  status: 'pending' | 'running' | 'done'
  content?: string
}

const STAGES: StageInfo[] = [
  { id: 'analyst', label: '分析师分析', status: 'pending' },
  { id: 'quality_gate', label: '数据质量门控', status: 'pending' },
  { id: 'debate', label: '多空辩论', status: 'pending' },
  { id: 'research_manager', label: '研究主管决策', status: 'pending' },
  { id: 'trader', label: '交易员方案', status: 'pending' },
  { id: 'risk', label: '风控评估', status: 'pending' },
  { id: 'pm', label: '最终决策', status: 'pending' },
]

export default function AnalysisPage({ params, searchParams }: PageProps) {
  const resolvedParams = use(params)
  const resolvedSearch = use(searchParams)
  const ticker = decodeURIComponent(resolvedParams.ticker)
  const date = resolvedSearch.date || new Date().toISOString().slice(0, 10)

  const [stages, setStages] = useState<StageInfo[]>(STAGES)
  const [finalDecision, setFinalDecision] = useState('')
  const [signal, setSignal] = useState('')
  const [report, setReport] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const resp = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, date }),
        })

        if (!resp.ok) {
          const err = await resp.json()
          throw new Error(err.error || '分析失败')
        }

        const reader = resp.body?.getReader()
        if (!reader) throw new Error('无法读取响应流')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = JSON.parse(line.slice(6))

            if (cancelled) return

            if (data.type === 'stage') {
              setStages(prev =>
                prev.map(s =>
                  s.id === data.stage ? { ...s, status: data.status, content: data.content || s.content } : s
                )
              )
            } else if (data.type === 'report') {
              setReport(data.content)
            } else if (data.type === 'complete') {
              setFinalDecision(data.decision)
              setSignal(data.signal)
            } else if (data.type === 'error') {
              setError(data.message)
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message)
      }
    }

    run()
    return () => { cancelled = true }
  }, [ticker, date])

  const stageLabels: Record<string, string> = {
    analyst: '分析师团队',
    quality_gate: '数据质量门控',
    debate: '多空辩论',
    research_manager: '研究主管',
    trader: '交易员',
    risk: '风控团队',
    pm: '投资组合主管',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[#f5f1eb]">
          {ticker} 分析报告
        </h1>
        <p className="text-sm text-[#888]">分析日期: {date}</p>
      </div>

      {/* 错误 */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* 进度 */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#f5f1eb]">分析进度</h2>
        <div className="grid grid-cols-2 gap-2">
          {stages.map(stage => (
            <div
              key={stage.id}
              className={`p-3 rounded-lg border text-sm ${
                stage.status === 'done'
                  ? 'bg-green-900/20 border-green-800 text-green-400'
                  : stage.status === 'running'
                  ? 'bg-blue-900/20 border-blue-800 text-blue-400'
                  : 'bg-[#161616] border-[#2a2a2a] text-[#555]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  stage.status === 'done' ? 'bg-green-500' :
                  stage.status === 'running' ? 'bg-blue-500 animate-pulse' :
                  'bg-[#555]'
                }`} />
                {stageLabels[stage.id] || stage.id}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 最终信号 */}
      {signal && (
        <div className={`p-6 rounded-lg border ${
          signal === 'Buy' || signal === 'Overweight'
            ? 'bg-green-900/20 border-green-800'
            : signal === 'Sell' || signal === 'Underweight'
            ? 'bg-red-900/20 border-red-800'
            : 'bg-yellow-900/20 border-yellow-800'
        }`}>
          <h2 className="text-lg font-semibold mb-2">最终决策</h2>
          <div className="text-2xl font-bold">{signal}</div>
        </div>
      )}

      {/* 最终报告 */}
      {finalDecision && (
        <div className="p-4 bg-[#161616] border border-[#2a2a2a] rounded-lg">
          <h2 className="text-lg font-semibold text-[#f5f1eb] mb-3">投资组合经理决策</h2>
          <div className="text-[#ccc] whitespace-pre-wrap text-sm leading-relaxed">
            {finalDecision}
          </div>
        </div>
      )}
    </div>
  )
}
