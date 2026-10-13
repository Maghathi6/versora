import {
  GenerateResponseOptions,
  GenerateResponseResult,
  IAIProvider,
} from './ai-provider.interface';
import {
  AIProviderError,
  AIProviderRateLimitError,
  AIProviderTimeoutError,
  AIProviderNotConfiguredError,
} from '../assistant.errors';

export interface OpenAIProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  defaultTimeoutMs?: number;
}

export class OpenAIProvider implements IAIProvider {
  readonly name = 'openai';
  private apiKey?: string;
  private baseUrl: string;
  private model: string;
  private defaultTimeoutMs: number;

  constructor(options: OpenAIProviderOptions = {}) {
    this.apiKey = options.apiKey?.trim();
    this.baseUrl = (options.baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.model = options.model?.trim() || 'gpt-4o-mini';
    this.defaultTimeoutMs = options.defaultTimeoutMs || 45000;
  }

  isConfigured(): boolean {
    // If using custom/ollama baseUrl without auth requirement, baseUrl is enough; otherwise apiKey is required
    if (this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1')) {
      return true;
    }
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async generateChatResponse(options: GenerateResponseOptions): Promise<GenerateResponseResult> {
    if (!this.isConfigured()) {
      throw new AIProviderNotConfiguredError(
        'OpenAI provider is not configured. Please supply a valid AI_API_KEY in environment variables.'
      );
    }

    const endpoint = `${this.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.defaultTimeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const payload = {
      model: this.model,
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 2000,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new AIProviderRateLimitError();
        }
        if (response.status === 401 || response.status === 403) {
          throw new AIProviderError('AI provider authentication failed. Please verify AI_API_KEY.');
        }

        let errBody = '';
        try {
          const jsonErr = (await response.json()) as any;
          errBody = jsonErr?.error?.message || response.statusText;
        } catch {
          errBody = response.statusText;
        }
        throw new AIProviderError(`AI provider request failed (${response.status}): ${errBody}`);
      }

      const data = await response.json() as any;
      const choice = data.choices?.[0];
      const content = choice?.message?.content || '';

      return {
        content,
        model: data.model || this.model,
        provider: this.name,
        finishReason: choice?.finish_reason || 'stop',
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new AIProviderTimeoutError();
      }
      if (err instanceof AIProviderError || err instanceof AIProviderRateLimitError) {
        throw err;
      }
      throw new AIProviderError(`Failed to communicate with OpenAI provider: ${err.message || 'Network error'}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
