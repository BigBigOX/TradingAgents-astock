'use client'

import { useState, useEffect } from 'react'

interface AppConfig {
  llmProvider: string
  apiKey: string
  baseUrl: string
  quickModel: string
  deepModel: string
  outputLanguage: string
  analysts: string[]
  maxDebateRounds: number
}

const PROVIDERS = [
  { key: 'deepseek', name: 'DeepSeek', defaultUrl: 'https://api.deepseek.com/v1' },
  { key: 'openai', name: 'OpenAI', defaultUrl: 'https://api.openai.com/v1' },
  { key: 'anthropic', name: 'Anthropic', defaultUrl: 'https://api.anthropic.com/v1' },
  { key: 'minimax', name: 'MiniMax', defaultUrl: 'https://api.minimax.chat/v1' },
  { key: 'qwen', name: '通义千问 Qwen', defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { key: 'glm', name: '智谱 GLM', defaultUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { key: 'google', name: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { key: 'xai', name: 'xAI Grok', defaultUrl: 'https://api.x.ai/v1' },
  { key: 'ollama', name: 'Ollama', defaultUrl: 'http://localhost:11434/v1' },
]

export function Settings() {
  const [config, setConfig] = useState<AppConfig>({
    llmProvider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    quickModel: 'deepseek-v4-flash',
    deepModel: 'deepseek-v4-pro',
    outputLanguage: 'Chinese',
    analysts: ['market', 'social', 'news', 'fundamentals', 'policy', 'hot_money', 'lockup'],
    maxDebateRounds: 1,
  })
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)

  // 加载配置
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        setConfig(prev => ({
          ...prev,
          ...data,
          apiKey: data.apiKey === '__SET__' ? MASKED_KEY : data.apiKey,
        }))
      })
      .catch(() => {})
  }, [])

  // 切换供应商时更新默认 API 地址和模型
  const handleProviderChange = (key: string) => {
    const provider = PROVIDERS.find(p => p.key === key)
    setConfig(prev => ({
      ...prev,
      llmProvider: key,
      baseUrl: provider?.defaultUrl || prev.baseUrl,
      quickModel: prev.quickModel,
      deepModel: prev.deepModel,
    }))
  }

  // 保存配置
  const MASKED_KEY = '\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF';

  const handleSave = async () => {
    try {
      const body = { ...config };
      if (body.apiKey === MASKED_KEY) {
        body.apiKey = '__SET__';
      }
      const resp = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (resp.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (e) {
      alert('保存失败')
    }
  }

  return (
    <div className="space-y-3 text-sm">
      {/* 供应商 */}
      <div>
        <label className="text-[#888] text-xs">LLM 供应商</label>
        <select
          value={config.llmProvider}
          onChange={e => handleProviderChange(e.target.value)}
          className="w-full mt-1 p-2 bg-[#161616] border border-[#2a2a2a] rounded text-[#f5f1eb] text-sm"
        >
          {PROVIDERS.map(p => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div>
        <label className="text-[#888] text-xs">API Key</label>
        <div className="flex mt-1 gap-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={config.apiKey}
            onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            placeholder="sk-..."
            className="flex-1 p-2 bg-[#161616] border border-[#2a2a2a] rounded text-[#f5f1eb] text-sm"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="px-2 bg-[#161616] border border-[#2a2a2a] rounded text-[#888] text-xs"
          >
            {showKey ? '隐藏' : '显示'}
          </button>
        </div>
      </div>

      {/* Base URL */}
      <div>
        <label className="text-[#888] text-xs">API Base URL</label>
        <input
          type="text"
          value={config.baseUrl}
          onChange={e => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
          placeholder="https://api.deepseek.com/v1"
          className="w-full mt-1 p-2 bg-[#161616] border border-[#2a2a2a] rounded text-[#f5f1eb] text-sm"
        />
      </div>

      {/* 快速模型 */}
      <div>
        <label className="text-[#888] text-xs">快速思考模型</label>
        <input
          type="text"
          value={config.quickModel}
          onChange={e => setConfig(prev => ({ ...prev, quickModel: e.target.value }))}
          className="w-full mt-1 p-2 bg-[#161616] border border-[#2a2a2a] rounded text-[#f5f1eb] text-sm"
        />
      </div>

      {/* 深度模型 */}
      <div>
        <label className="text-[#888] text-xs">深度思考模型</label>
        <input
          type="text"
          value={config.deepModel}
          onChange={e => setConfig(prev => ({ ...prev, deepModel: e.target.value }))}
          className="w-full mt-1 p-2 bg-[#161616] border border-[#2a2a2a] rounded text-[#f5f1eb] text-sm"
        />
      </div>

      {/* 辩论轮数 */}
      <div>
        <label className="text-[#888] text-xs">辩论轮数</label>
        <select
          value={config.maxDebateRounds}
          onChange={e => setConfig(prev => ({ ...prev, maxDebateRounds: parseInt(e.target.value) }))}
          className="w-full mt-1 p-2 bg-[#161616] border border-[#2a2a2a] rounded text-[#f5f1eb] text-sm"
        >
          <option value={1}>1 轮（快速）</option>
          <option value={2}>2 轮</option>
          <option value={3}>3 轮（深度）</option>
        </select>
      </div>

      {/* 保存按钮 */}
      <button
        onClick={handleSave}
        className="w-full py-2 bg-gradient-to-r from-[#ff5a1f] to-[#ff8c42] rounded-lg text-white font-bold text-sm"
      >
        {saved ? '已保存 ✓' : '保存配置'}
      </button>
    </div>
  )
}
