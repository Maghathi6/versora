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

export interface GeminiProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  defaultTimeoutMs?: number;
}

export class GeminiProvider implements IAIProvider {
  readonly name = 'gemini';
  private apiKey?: string;
  private baseUrl: string;
  private model: string;
  private defaultTimeoutMs: number;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = options.apiKey?.trim();
    this.baseUrl = (options.baseUrl?.trim() || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
    this.model = options.model?.trim() || 'gemini-1.5-flash';
    this.defaultTimeoutMs = options.defaultTimeoutMs || 45000;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async generateChatResponse(options: GenerateResponseOptions): Promise<GenerateResponseResult> {
    if (!this.isConfigured()) {
      throw new AIProviderNotConfiguredError(
        'Google Gemini provider is not configured. Please supply a valid AI_API_KEY in environment variables.'
      );
    }

    const endpoint = `${this.baseUrl}/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey!)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.defaultTimeoutMs);

    const systemMessage = options.messages.find((m) => m.role === 'system')?.content || '';
    const nonSystemMessages = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    if (nonSystemMessages.length === 0) {
      nonSystemMessages.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    const payload: any = {
      contents: nonSystemMessages,
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxTokens ?? 2000,
      },
    };

    if (systemMessage) {
      payload.systemInstruction = {
        parts: [{ text: systemMessage }],
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new AIProviderRateLimitError();
        }
        if (response.status === 401 || response.status === 403) {
          throw new AIProviderError('Google Gemini authentication failed. Please check AI_API_KEY.');
        }

        let errBody = '';
        try {
          const jsonErr = (await response.json()) as any;
          errBody = jsonErr?.error?.message || response.statusText;
        } catch {
          errBody = response.statusText;
        }
        throw new AIProviderError(`Google Gemini API request failed (${response.status}): ${errBody}`);
      }

      const data = await response.json() as any;
      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      const content = part?.text || '';

      return {
        content,
        model: this.model,
        provider: this.name,
        finishReason: candidate?.finishReason || 'STOP',
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount,
          totalTokens: data.usageMetadata?.totalTokenCount,
        },
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new AIProviderTimeoutError();
      }
      if (err instanceof AIProviderError || err instanceof AIProviderRateLimitError) {
        throw err;
      }
      throw new AIProviderError(`Failed to communicate with Google Gemini provider: ${err.message || 'Network error'}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
