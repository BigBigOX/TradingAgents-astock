/**
 * 配置持久化 API — GET 读取配置，POST 保存配置
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { loadConfig, saveConfig, type AppConfig } from '../../src/data/config'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method === 'GET') {
    const config = loadConfig()
    res.status(200).json({
      ...config,
      apiKey: config.apiKey ? '__SET__' : '',
    })
    return
  }

  if (req.method === 'POST') {
    const body = req.body as Partial<AppConfig>
    const current = loadConfig()
    let apiKey = body.apiKey
    if (apiKey === '__SET__') {
      apiKey = current.apiKey
    }
    const newConfig: AppConfig = {
      llmProvider: body.llmProvider ?? current.llmProvider,
      apiKey: apiKey ?? current.apiKey,
      baseUrl: body.baseUrl ?? current.baseUrl,
      quickModel: body.quickModel ?? current.quickModel,
      deepModel: body.deepModel ?? current.deepModel,
      outputLanguage: body.outputLanguage ?? current.outputLanguage,
      analysts: body.analysts ?? current.analysts,
      maxDebateRounds: body.maxDebateRounds ?? current.maxDebateRounds,
    }
    saveConfig(newConfig)
    res.status(200).json({
      success: true,
      config: { ...newConfig, apiKey: newConfig.apiKey ? '__SET__' : '' },
    })
    return
  }

  res.status(405).json({ error: '不支持的方法' })
}
