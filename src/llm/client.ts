/**
 * LLM Client 接口定义
 */

export interface LLMResponse {
  content: string
  toolCalls?: ToolCallResult[]
  /** 结构化输出解析结果 */
  parsed?: unknown
}

export interface ToolCallResult {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  name?: string
}

export interface InvokeOptions {
  tools?: ToolDefinition[]
  /** 结构化输出 schema */
  responseSchema?: Record<string, unknown>
  /** 流式回调 */
  onStream?: (chunk: string) => void
  /** 自定义 API 地址 */
  baseUrl?: string
  /** API Key */
  apiKey?: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface LLMClient {
  invoke(messages: ChatMessage[], options?: InvokeOptions): Promise<LLMResponse>
}

/** OpenAI-compatible 格式的请求体 */
interface OpenAIRequest {
  model: string
  messages: { role: string; content: string }[]
  stream?: boolean
  tools?: any[]
  response_format?: { type: string; json_schema?: any }
}

/** OpenAI-compatible 格式的响应体 */
interface OpenAIResponse {
  choices: {
    message: {
      content: string | null
      tool_calls?: {
        id: string
        type: string
        function: { name: string; arguments: string }
      }[]
    }
    finish_reason: string
  }[]
}

/** 判断 provider 是否兼容 OpenAI 格式 */
export function isOpenAICompatible(provider: string): boolean {
  return ['openai', 'deepseek', 'qwen', 'glm', 'minimax', 'xai', 'ollama'].includes(provider)
}

/** 发起 LLM 调用 */  // <-- 中文注释
export async function invokeLLM(
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  baseUrl: string,
  options?: InvokeOptions,
): Promise<LLMResponse> {
  const url = `${baseUrl}/chat/completions`

  const body: OpenAIRequest = {
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  }

  if (options?.tools && options.tools.length > 0) {
    body.tools = options.tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))
  }

  if (options?.responseSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'response',
        schema: options.responseSchema,
      },
    }
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`LLM API 错误 (${resp.status}): ${errText}`)
  }

  const data: OpenAIResponse = await resp.json()
  const choice = data.choices?.[0]
  if (!choice) throw new Error('LLM 返回空响应')

  const response: LLMResponse = {
    content: choice.message.content || '',
  }

  if (choice.message.tool_calls) {
    response.toolCalls = choice.message.tool_calls.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments),
    }))
  }

  return response
}

/** 调用 LLM 并解析结构化输出 */
export async function invokeStructured<T>(
  model: string,
  messages: ChatMessage[],
  schema: Record<string, unknown>,
  apiKey: string,
  baseUrl: string,
): Promise<T> {
  const response = await invokeLLM(model, messages, apiKey, baseUrl, {
    responseSchema: schema,
  })
  try {
    return JSON.parse(response.content) as T
  } catch {
    throw new Error(`LLM 结构化输出解析失败: ${response.content.slice(0, 200)}`)
  }
}
