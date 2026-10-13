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

export interface AnthropicProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  defaultTimeoutMs?: number;
}

export class AnthropicProvider implements IAIProvider {
  readonly name = 'anthropic';
  private apiKey?: string;
  private baseUrl: string;
  private model: string;
  private defaultTimeoutMs: number;

  constructor(options: AnthropicProviderOptions = {}) {
    this.apiKey = options.apiKey?.trim();
    this.baseUrl = (options.baseUrl?.trim() || 'https://api.anthropic.com').replace(/\/+$/, '');
    this.model = options.model?.trim() || 'claude-3-5-sonnet-20241022';
    this.defaultTimeoutMs = options.defaultTimeoutMs || 45000;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async generateChatResponse(options: GenerateResponseOptions): Promise<GenerateResponseResult> {
    if (!this.isConfigured()) {
      throw new AIProviderNotConfiguredError(
        'Anthropic provider is not configured. Please supply a valid AI_API_KEY in environment variables.'
      );
    }

    const endpoint = `${this.baseUrl}/v1/messages`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.defaultTimeoutMs);

    // Anthropic requires system prompt in top-level `system` field
    const systemMessage = options.messages.find((m) => m.role === 'system')?.content || '';
    const nonSystemMessages = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    if (nonSystemMessages.length === 0) {
      nonSystemMessages.push({ role: 'user', content: 'Hello' });
    }

    const payload = {
      model: this.model,
      system: systemMessage || undefined,
      messages: nonSystemMessages,
      max_tokens: options.maxTokens ?? 2000,
      temperature: options.temperature ?? 0.2,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new AIProviderRateLimitError();
        }
        if (response.status === 401 || response.status === 403) {
          throw new AIProviderError('Anthropic provider authentication failed. Please check AI_API_KEY.');
        }

        let errBody = '';
        try {
          const jsonErr = (await response.json()) as any;
          errBody = jsonErr?.error?.message || response.statusText;
        } catch {
          errBody = response.statusText;
        }
        throw new AIProviderError(`Anthropic API request failed (${response.status}): ${errBody}`);
      }

      const data = await response.json() as any;
      const contentBlock = data.content?.[0];
      const content = contentBlock?.text || '';

      return {
        content,
        model: data.model || this.model,
        provider: this.name,
        finishReason: data.stop_reason || 'end_turn',
        usage: {
          promptTokens: data.usage?.input_tokens,
          completionTokens: data.usage?.output_tokens,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new AIProviderTimeoutError();
      }
      if (err instanceof AIProviderError || err instanceof AIProviderRateLimitError) {
        throw err;
      }
      throw new AIProviderError(`Failed to communicate with Anthropic provider: ${err.message || 'Network error'}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
