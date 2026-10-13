import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIProvider } from './openai.provider';
import { AIProviderError } from '../assistant.errors';

describe('Ollama AI Provider (Unit & Integration Tests)', () => {
  it('should identify provider name as "ollama" and default model to qwen3.5:4b', () => {
    const provider = new OpenAIProvider({
      providerName: 'ollama',
      baseUrl: 'http://localhost:11434',
    });

    assert.equal(provider.name, 'ollama');
    assert.equal(provider.model, 'qwen3.5:4b');
    assert.equal(provider.isConfigured(), true);
  });

  it('should normalize base URL to include /v1 endpoint for Ollama', () => {
    const providerWithoutV1 = new OpenAIProvider({
      providerName: 'ollama',
      baseUrl: 'http://localhost:11434/',
    });
    assert.equal((providerWithoutV1 as any).baseUrl, 'http://localhost:11434/v1');

    const providerWithV1 = new OpenAIProvider({
      providerName: 'ollama',
      baseUrl: 'http://localhost:11434/v1/',
    });
    assert.equal((providerWithV1 as any).baseUrl, 'http://localhost:11434/v1');
  });

  it('should provide clear offline instructions when connection is refused', async () => {
    // Point to an unused port to simulate offline Ollama daemon
    const provider = new OpenAIProvider({
      providerName: 'ollama',
      baseUrl: 'http://127.0.0.1:59999/v1',
      model: 'qwen3.5:4b',
      defaultTimeoutMs: 2000,
    });

    await assert.rejects(
      async () => {
        await provider.generateChatResponse({
          messages: [{ role: 'user', content: 'test offline' }],
        });
      },
      (err: any) => {
        assert.ok(err instanceof AIProviderError);
        assert.ok(err.message.includes('Ollama is offline or unreachable'));
        assert.ok(err.message.includes('ollama serve'));
        return true;
      }
    );
  });

  it('should accept custom configured model for Ollama', () => {
    const provider = new OpenAIProvider({
      providerName: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'gemma4:e2b',
    });

    assert.equal(provider.name, 'ollama');
    assert.equal(provider.model, 'gemma4:e2b');
  });
});
