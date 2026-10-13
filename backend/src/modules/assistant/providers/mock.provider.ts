import {
  GenerateResponseOptions,
  GenerateResponseResult,
  IAIProvider,
} from './ai-provider.interface';
import {
  AIProviderRateLimitError,
  AIProviderTimeoutError,
  AIProviderError,
} from '../assistant.errors';

export interface MockProviderOptions {
  isConfigured?: boolean;
  mockResponse?: string;
  responseGenerator?: (options: GenerateResponseOptions) => string;
  simulateErrorType?: 'rate_limit' | 'timeout' | 'error';
  shouldFail?: boolean;
  failureError?: Error;
}

export class MockAIProvider implements IAIProvider {
  readonly name = 'mock';
  private configured: boolean = true;
  private mockResponse?: string;
  private responseGenerator?: (options: GenerateResponseOptions) => string;
  private simulateErrorType?: 'rate_limit' | 'timeout' | 'error';
  private shouldFail?: boolean;
  private failureError?: Error;

  constructor(optionsOrConfigured: boolean | MockProviderOptions = true) {
    if (typeof optionsOrConfigured === 'boolean') {
      this.configured = optionsOrConfigured;
    } else {
      this.setOptions(optionsOrConfigured);
    }
  }

  setOptions(options: MockProviderOptions): void {
    if (options.isConfigured !== undefined) this.configured = options.isConfigured;
    if (options.mockResponse !== undefined) this.mockResponse = options.mockResponse;
    if (options.responseGenerator !== undefined) this.responseGenerator = options.responseGenerator;
    if (options.simulateErrorType !== undefined) this.simulateErrorType = options.simulateErrorType;
    if (options.shouldFail !== undefined) this.shouldFail = options.shouldFail;
    if (options.failureError !== undefined) this.failureError = options.failureError;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  setConfigured(val: boolean): void {
    this.configured = val;
  }

  setResponseGenerator(fn: (options: GenerateResponseOptions) => string): void {
    this.responseGenerator = fn;
  }

  setSimulateError(errType?: 'rate_limit' | 'timeout' | 'error'): void {
    this.simulateErrorType = errType;
  }

  async generateChatResponse(options: GenerateResponseOptions): Promise<GenerateResponseResult> {
    if (this.shouldFail && this.failureError) {
      throw this.failureError;
    }
    if (this.simulateErrorType === 'rate_limit') {
      throw new AIProviderRateLimitError();
    }
    if (this.simulateErrorType === 'timeout') {
      throw new AIProviderTimeoutError();
    }
    if (this.simulateErrorType === 'error') {
      throw new AIProviderError('Mock provider simulated error');
    }

    if (this.mockResponse) {
      return {
        content: this.mockResponse,
        model: 'mock-model-v1',
        provider: 'mock',
        finishReason: 'stop',
        usage: { promptTokens: 120, completionTokens: 60, totalTokens: 180 },
      };
    }

    if (this.responseGenerator) {
      const generated = this.responseGenerator(options);
      return {
        content: generated,
        model: 'mock-model-v1',
        provider: 'mock',
        finishReason: 'stop',
        usage: { promptTokens: 120, completionTokens: 60, totalTokens: 180 },
      };
    }

    // Default mock response: inspects user query and context to give a grounded answer
    const lastUserMsg = [...options.messages].reverse().find((m) => m.role === 'user')?.content || '';
    const systemMsg = options.messages.find((m) => m.role === 'system')?.content || '';

    let content = `Based on the project data for this workspace:\n\n`;

    if (lastUserMsg.toLowerCase().includes('what does this project do') || lastUserMsg.toLowerCase().includes('summary')) {
      content += `This project is managed in Versora with automated change tracking and impact analysis.\n`;
    } else if (lastUserMsg.toLowerCase().includes('explain') || lastUserMsg.toLowerCase().includes('artifact')) {
      content += `The requested artifact has been analyzed within the project context.\n`;
    } else if (lastUserMsg.toLowerCase().includes('commit') || lastUserMsg.toLowerCase().includes('git')) {
      content += `Version history records verify the latest changes in the repository.\n`;
    } else {
      content += `I have analyzed the provided project evidence to address your inquiry: "${lastUserMsg}".\n`;
    }

    // Include detected references from system context if present
    const artifactMatch = systemMsg.match(/Path:\s*([^\s\n]+)/);
    if (artifactMatch) {
      content += `\nRelevant file: [artifact:${artifactMatch[1]}]`;
    }

    const commitMatch = systemMsg.match(/Hash:\s*([a-f0-9]{7,40})/i);
    if (commitMatch) {
      content += `\nReferenced commit: [commit:${commitMatch[1]}]`;
    }

    return {
      content,
      model: 'mock-model-v1',
      provider: 'mock',
      finishReason: 'stop',
      usage: {
        promptTokens: 150,
        completionTokens: 80,
        totalTokens: 230,
      },
    };
  }
}
