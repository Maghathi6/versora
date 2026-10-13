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
  providerName?: 'openai' | 'ollama' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  defaultTimeoutMs?: number;
}

export class OpenAIProvider implements IAIProvider {
  readonly name: string;
  readonly model: string;
  private apiKey?: string;
  private baseUrl: string;
  private defaultTimeoutMs: number;

  constructor(options: OpenAIProviderOptions = {}) {
    this.name = options.providerName || 'openai';
    this.apiKey = options.apiKey?.trim();

    let rawBase = options.baseUrl?.trim() || (this.name === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1');
    rawBase = rawBase.replace(/\/+$/, '');
    if (this.name === 'ollama' && !rawBase.endsWith('/v1')) {
      rawBase = `${rawBase}/v1`;
    }
    this.baseUrl = rawBase;

    this.model = options.model?.trim() || (this.name === 'ollama' ? 'qwen3.5:4b' : 'gpt-4o-mini');
    this.defaultTimeoutMs = options.defaultTimeoutMs || (this.name === 'ollama' ? 360000 : 45000);
  }

  isConfigured(): boolean {
    if (this.name === 'ollama') {
      return Boolean(this.baseUrl);
    }
    if (this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1')) {
      return true;
    }
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async generateChatResponse(options: GenerateResponseOptions): Promise<GenerateResponseResult> {
    if (!this.isConfigured()) {
      const msg = this.name === 'ollama'
        ? 'Ollama provider is not configured. Please ensure AI_BASE_URL points to your Ollama endpoint.'
        : 'OpenAI provider is not configured. Please supply a valid AI_API_KEY in environment variables.';
      throw new AIProviderNotConfiguredError(msg);
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
      max_tokens: options.maxTokens ?? 1000,
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
          throw new AIProviderError(
            this.name === 'ollama'
              ? 'Ollama request authorization rejected.'
              : 'AI provider authentication failed. Please verify AI_API_KEY.'
          );
        }

        let errBody = '';
        try {
          const jsonErr = (await response.json()) as any;
          errBody = jsonErr?.error?.message || jsonErr?.error || jsonErr?.message || response.statusText;
        } catch {
          errBody = response.statusText;
        }

        if (this.name === 'ollama' && response.status === 404) {
          throw new AIProviderError(
            `Model '${this.model}' is not installed in local Ollama (${errBody}). Please download it in your terminal by running: ollama pull ${this.model}`
          );
        }

        const label = this.name === 'ollama' ? 'Ollama' : 'AI provider';
        throw new AIProviderError(`${label} request failed (${response.status}): ${errBody}`);
      }

      const data = (await response.json()) as any;
      const choice = data.choices?.[0];
      let content = choice?.message?.content || '';

      // If content is empty but model provided reasoning / thinking process, use reasoning as content
      if (!content.trim() && (choice?.message?.reasoning || choice?.message?.reasoning_content)) {
        content = (choice.message.reasoning || choice.message.reasoning_content).trim();
      }

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
        const timeoutSecs = Math.round((options.timeoutMs || this.defaultTimeoutMs) / 1000);
        throw new AIProviderTimeoutError(
          this.name === 'ollama'
            ? `Ollama request timed out after ${timeoutSecs}s. Local model inference on CPU requires extra time; consider asking a more concise question or checking system resources.`
            : `The AI request timed out after ${timeoutSecs}s.`
        );
      }
      if (err instanceof AIProviderError || err instanceof AIProviderRateLimitError || err instanceof AIProviderTimeoutError) {
        throw err;
      }

      if (this.name === 'ollama') {
        const isConnRefused =
          err.code === 'ECONNREFUSED' ||
          err.cause?.code === 'ECONNREFUSED' ||
          err.message?.includes('ECONNREFUSED') ||
          err.message?.includes('fetch failed');
        if (isConnRefused) {
          const hostDisplay = this.baseUrl.replace(/\/v1$/, '');
          throw new AIProviderError(
            `Ollama is offline or unreachable at ${hostDisplay}. Please make sure Ollama is running on your system (e.g., run 'ollama serve' in Command Prompt or launch the Ollama application).`
          );
        }
        throw new AIProviderError(`Ollama request failed: ${err.message || 'Unknown network error'}`);
      }

      throw new AIProviderError(`Failed to communicate with OpenAI provider: ${err.message || 'Network error'}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
