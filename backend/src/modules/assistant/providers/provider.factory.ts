import { env } from '../../../config/env';
import { IAIProvider } from './ai-provider.interface';
import { MockAIProvider } from './mock.provider';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';

let testProviderOverride: IAIProvider | null = null;

export class AIProviderFactory {
  static getProvider(): IAIProvider {
    if (testProviderOverride) {
      return testProviderOverride;
    }

    const providerType = env.AI_PROVIDER?.toLowerCase() || 'mock';

    switch (providerType) {
      case 'openai':
      case 'ollama':
      case 'custom':
        return new OpenAIProvider({
          apiKey: env.AI_API_KEY,
          baseUrl: env.AI_BASE_URL || (providerType === 'ollama' ? 'http://localhost:11434/v1' : undefined),
          model: env.AI_MODEL || (providerType === 'ollama' ? 'llama3' : 'gpt-4o-mini'),
        });

      case 'anthropic':
        return new AnthropicProvider({
          apiKey: env.AI_API_KEY,
          baseUrl: env.AI_BASE_URL,
          model: env.AI_MODEL || 'claude-3-5-sonnet-20241022',
        });

      case 'gemini':
        return new GeminiProvider({
          apiKey: env.AI_API_KEY,
          baseUrl: env.AI_BASE_URL,
          model: env.AI_MODEL || 'gemini-1.5-flash',
        });

      case 'mock':
      default:
        // Mock provider is active when provider is explicitly set to 'mock' or in test environment
        const isTest = env.NODE_ENV === 'test';
        return new MockAIProvider(isTest || Boolean(env.AI_PROVIDER === 'mock'));
    }
  }

  static setProviderForTesting(provider: IAIProvider | null): void {
    testProviderOverride = provider;
  }

  static setProviderOverride(provider: IAIProvider | null): void {
    testProviderOverride = provider;
  }
}
