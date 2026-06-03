/**
 * LLM Client 接口定义
 */

export interface LLMResponse {
  content: string
  toolCalls?: ToolCallResult[]
  parsed?: unknown
}

export interface ToolCallResult {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ChatMessage {
  toolCalls?: ToolCallResult[]
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  name?: string
}

export interface InvokeOptions {
  tools?: ToolDefinition[]
  onStream?: (chunk: string) => void
  baseUrl?: string
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

interface OpenAIMessage {
  role: string
  content: string
  tool_call_id?: string
  name?: string
  tool_calls?: {
    id: string
    type: string
    function: { name: string; arguments: string }
  }[]
}

interface OpenAIRequest {
  model: string
  messages: OpenAIMessage[]
  stream?: boolean
  tools?: any[]
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string | null
      reasoning_content?: string
      tool_calls?: {
        id: string
        type: string
        function: { name: string; arguments: string }
      }[]
    }
    finish_reason: string
  }[]
}

const DEEPSEEK_MODEL_MAP: Record<string, string> = {
  'deepseek-v4-flash': 'deepseek-chat',
  'deepseek-v4-pro': 'deepseek-chat',
}

export function isOpenAICompatible(provider: string): boolean {
  return ['openai', 'deepseek', 'qwen', 'glm', 'minimax', 'xai', 'ollama'].includes(provider)
}

function toOpenAIMessage(m: ChatMessage): OpenAIMessage {
  const base: OpenAIMessage = { role: m.role, content: m.content };
  if (m.role === 'tool' && m.toolCallId) {
    base.tool_call_id = m.toolCallId;
  }
  if (m.name) {
    base.name = m.name;
  }
  return base;
}

export async function invokeLLM(
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  baseUrl: string,
  options?: InvokeOptions,
): Promise<LLMResponse> {
  // DeepSeek 模型名映射：v4-flash/pro 改为 deepseek-chat（非思考模式）
  const actualModel = DEEPSEEK_MODEL_MAP[model] || model;
  const url = baseUrl + '/chat/completions';

  const apiMessages: OpenAIMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const apiMsg = toOpenAIMessage(m);
    if (m.role === 'assistant' && (m as any).toolCalls) {
      const tcs = (m as any).toolCalls as ToolCallResult[];
      if (tcs.length > 0) {
        (apiMsg as any).tool_calls = tcs.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        }));
      }
    }
    apiMessages.push(apiMsg);
  }

  const body: OpenAIRequest = { model: actualModel, messages: apiMessages };

  if (options?.tools && options.tools.length > 0) {
    body.tools = options.tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  const resp = await fetch(url, {
    signal: controller.signal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify(body),
  });
  clearTimeout(timeoutId);

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('LLM API 错误 (' + resp.status + '): ' + errText);
  }

  const data: OpenAIResponse = await resp.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error('LLM 返回空响应');

  let content = choice.message.content || '';
  if (!content && (choice.message as any).reasoning_content) {
    content = (choice.message as any).reasoning_content;
  }

  const response: LLMResponse = { content };
  if (choice.message.tool_calls) {
    response.toolCalls = choice.message.tool_calls.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments),
    }));
  }
  return response;
}
