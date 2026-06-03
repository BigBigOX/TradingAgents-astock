/**
 * 配置管理 + 持久化（AES 加密）
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'

/** 持久化配置结构 */
export interface AppConfig {
  llmProvider: string
  apiKey: string
  baseUrl: string
  quickModel: string
/** 获取机器级稳定密钥（基于主机名 + 机器 ID，不依赖外部文件）*/
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
  maxDebateRounds: 0,
}

/** 配置文件路径 */
function getConfigPath(): string {
  return path.join(os.homedir(), '.tradingagents', 'config.json')
}

/** 确保配置目录存在 */
function ensureConfigDir(): void {
  const dir = path.dirname(getConfigPath())
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// ---- AES-256-GCM 加密工具 ----

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16
function getMachineKey(): Buffer {
  const hostname = os.hostname()
  const platform = os.platform()
  const raw = 'tradingagents-' + hostname + '-' + platform
  return crypto.createHash('sha256').update(raw).digest()
}

/** 加密明文 */
function encrypt(plaintext: string): string {
  if (!plaintext) return ''
  const key = getMachineKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')
  // 格式: iv:tag:ciphertext
  return iv.toString('hex') + ':' + tag + ':' + encrypted
}

/** 读取配置（自动解密apiKey）*/
function decrypt(ciphertext: string): string {
  if (!ciphertext) return ''
  try {
    const parts = ciphertext.split(':')
    if (parts.length !== 3) return ''
    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]
    const key = getMachineKey()
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return ''
  }
}

// ---- 配置读写 ----

/** 读取配置（自动解密apiKey）*/
export function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(raw)
      // 解密 apiKey
      if (parsed.apiKey) {
        const decrypted = decrypt(parsed.apiKey)
        if (decrypted) parsed.apiKey = decrypted
      }
      return { ...DEFAULT_CONFIG, ...parsed }
    }
  } catch {
    // 读取失败时返回默�?  }
  return { ...DEFAULT_CONFIG }
}

/** 保存配置（自动加密apiKey）*/
  ensureConfigDir()
  const configPath = getConfigPath()
  const toSave = { ...config }
  // 加密 apiKey
  if (toSave.apiKey) {
    toSave.apiKey = encrypt(toSave.apiKey)
  }
  fs.writeFileSync(configPath, JSON.stringify(toSave, null, 2), 'utf-8')
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
