/**
 * 配置管理 + 持久化
 * 存储位置: ~/.tradingagents/config.json
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

/** 持久化配置结构 */
export interface AppConfig {
  llmProvider: string
  apiKey: string
  baseUrl: string
  quickModel: string
  deepModel: string
  outputLanguage: string
  analysts: string[]
  maxDebateRounds: number
}

/** 默认配置 */
export const DEFAULT_CONFIG: AppConfig = {
  llmProvider: 'deepseek',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  quickModel: 'deepseek-v4-flash',
  deepModel: 'deepseek-v4-pro',
  outputLanguage: 'Chinese',
  analysts: ['market', 'social', 'news', 'fundamentals', 'policy', 'hot_money', 'lockup'],
  maxDebateRounds: 1,
}

/** 配置文件路径 */
function getConfigPath(): string {
  const home = os.homedir()
  return path.join(home, '.tradingagents', 'config.json')
}

/** 确保配置目录存在 */
function ensureConfigDir(): void {
  const dir = path.dirname(getConfigPath())
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/** 读取配置（服务端使用） */
export function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    }
  } catch {
    // 读取失败时返回默认
  }
  return { ...DEFAULT_CONFIG }
}

/** 保存配置（服务端使用） */
export function saveConfig(config: AppConfig): void {
  ensureConfigDir()
  const configPath = getConfigPath()
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

/** Provider 对应默认 API 地址 */
export const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; displayName: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', displayName: 'OpenAI' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', displayName: 'Anthropic' },
  google: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', displayName: 'Google Gemini' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', displayName: 'DeepSeek' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', displayName: '通义千问 Qwen' },
  glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', displayName: '智谱 GLM' },
  minimax: { baseUrl: 'https://api.minimax.chat/v1', displayName: 'MiniMax' },
  xai: { baseUrl: 'https://api.x.ai/v1', displayName: 'xAI Grok' },
  ollama: { baseUrl: 'http://localhost:11434/v1', displayName: 'Ollama（本地）' },
}

/** Provider 对应的模型选项 */
export const MODEL_OPTIONS: Record<string, { quick: { label: string; value: string }[]; deep: { label: string; value: string }[] }> = {
  openai: {
    quick: [
      { label: 'GPT-5.4 Mini', value: 'gpt-5.4-mini' },
      { label: 'GPT-5.4 Nano', value: 'gpt-5.4-nano' },
      { label: 'GPT-4.1', value: 'gpt-4.1' },
    ],
    deep: [
      { label: 'GPT-5.4', value: 'gpt-5.4' },
      { label: 'GPT-5.2', value: 'gpt-5.2' },
      { label: 'GPT-5.4 Pro', value: 'gpt-5.4-pro' },
    ],
  },
  anthropic: {
    quick: [
      { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
      { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
    ],
    deep: [
      { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
      { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
    ],
  },
  google: {
    quick: [
      { label: 'Gemini 3 Flash', value: 'gemini-3-flash-preview' },
      { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    ],
    deep: [
      { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro-preview' },
      { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    ],
  },
  deepseek: {
    quick: [
      { label: 'DeepSeek V4 Flash', value: 'deepseek-v4-flash' },
      { label: 'DeepSeek V3.2', value: 'deepseek-chat' },
      { label: '自定义模型', value: 'custom' },
    ],
    deep: [
      { label: 'DeepSeek V4 Pro', value: 'deepseek-v4-pro' },
      { label: 'DeepSeek V3.2 (thinking)', value: 'deepseek-reasoner' },
      { label: 'DeepSeek V3.2', value: 'deepseek-chat' },
      { label: '自定义模型', value: 'custom' },
    ],
  },
  qwen: {
    quick: [
      { label: 'Qwen 3.5 Flash', value: 'qwen3.5-flash' },
      { label: 'Qwen Plus', value: 'qwen-plus' },
    ],
    deep: [
      { label: 'Qwen 3.6 Plus', value: 'qwen3.6-plus' },
      { label: 'Qwen 3 Max', value: 'qwen3-max' },
    ],
  },
  glm: {
    quick: [
      { label: 'GLM-4.7', value: 'glm-4.7' },
      { label: 'GLM-5', value: 'glm-5' },
    ],
    deep: [
      { label: 'GLM-5.1', value: 'glm-5.1' },
      { label: 'GLM-5', value: 'glm-5' },
    ],
  },
  minimax: {
    quick: [
      { label: 'MiniMax-M2.7-highspeed', value: 'MiniMax-M2.7-highspeed' },
    ],
    deep: [
      { label: 'MiniMax-M2.7', value: 'MiniMax-M2.7' },
      { label: 'MiniMax-M2.7-highspeed', value: 'MiniMax-M2.7-highspeed' },
    ],
  },
  xai: {
    quick: [
      { label: 'Grok 4.1 Fast', value: 'grok-4-1-fast-non-reasoning' },
    ],
    deep: [
      { label: 'Grok 4', value: 'grok-4-0709' },
    ],
  },
  ollama: {
    quick: [
      { label: 'Qwen3 (8B)', value: 'qwen3:latest' },
    ],
    deep: [
      { label: 'GLM-4.7-Flash', value: 'glm-4.7-flash:latest' },
    ],
  },
}
