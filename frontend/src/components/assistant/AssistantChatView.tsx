import React, { useState, useRef, useEffect } from 'react';
import {
  AssistantConversation,
  AssistantMessage,
  AssistantConfigResponse,
  QuickActionType,
} from '../../types/assistant';
import { AssistantMessageBubble } from './AssistantMessageBubble';
import {
  IconSparkles,
  IconSend,
  IconAlertTriangle,
  IconGitCommit,
  IconActivity,
  IconTasks,
  IconRefreshCw,
} from '../common/Icons';

interface AssistantChatViewProps {
  conversation: AssistantConversation | null;
  messages: AssistantMessage[];
  config: AssistantConfigResponse | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  onSendMessage: (content: string) => Promise<void>;
  onTriggerQuickAction: (action: QuickActionType, targetId?: string) => Promise<void>;
  onNavigateToArtifact?: (pathOrId: string) => void;
  onNavigateToCommit?: (hash: string) => void;
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToReview?: (reviewId: string) => void;
}

const STARTER_PROMPTS = [
  {
    title: 'Project Overview',
    prompt: 'What does this project do and what are its main architectural components?',
    icon: <IconSparkles size={16} className="text-primary-400" />,
  },
  {
    title: 'Recent Changes',
    prompt: 'What changed in the latest commits and who made those changes?',
    icon: <IconGitCommit size={16} className="text-amber-400" />,
  },
  {
    title: 'Pending Reviews & Tasks',
    prompt: 'What code reviews and tasks are still open and need attention?',
    icon: <IconTasks size={16} className="text-emerald-400" />,
  },
  {
    title: 'Change Impact',
    prompt: 'Explain the potential impact across connected artifacts if key files are modified.',
    icon: <IconActivity size={16} className="text-purple-400" />,
  },
];

export const AssistantChatView: React.FC<AssistantChatViewProps> = ({
  conversation,
  messages,
  config,
  isLoading,
  isSending,
  error,
  onSendMessage,
  onTriggerQuickAction,
  onNavigateToArtifact,
  onNavigateToCommit,
  onNavigateToTask,
  onNavigateToReview,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Adjust textarea height automatically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [input]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isSending || isLoading) return;

    const content = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isConfigured = config?.configured ?? true;

  return (
    <div className="flex flex-col h-full bg-surface-900/40 relative">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-surface-800 flex items-center justify-between gap-4 bg-surface-900/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 flex-shrink-0">
            <IconSparkles size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-sm text-surface-100 truncate">
              {conversation ? conversation.title : 'AI Project Assistant'}
            </h2>
            <p className="text-[11px] text-surface-400 truncate">
              Grounded in real files, commits, relationships, reviews, and tasks
            </p>
          </div>
        </div>

        {/* Provider badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {config && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                config.configured
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  config.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>{config.configured ? `${config.provider} (${config.model || 'active'})` : 'AI Not Configured'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Unconfigured Provider Banner */}
      {!isConfigured && (
        <div className="m-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3 shadow-lg">
          <IconAlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-100">AI Model Provider Not Configured</div>
            <p className="text-amber-200/90 leading-relaxed">
              To enable live AI generation, configure an AI provider in your backend{' '}
              <code className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[11px]">.env</code>:
            </p>
            <div className="mt-2 p-2 rounded bg-black/50 font-mono text-[11px] text-surface-300 space-y-0.5 select-all">
              <div># Choose: openai, anthropic, gemini, or ollama</div>
              <div>AI_PROVIDER=openai</div>
              <div>AI_API_KEY=your_api_key_here</div>
              <div>AI_MODEL=gpt-4o-mini</div>
            </div>
            <p className="text-[11px] text-amber-300/80 mt-1">
              For local private offline LLMs, you can set <code className="font-mono">AI_PROVIDER=ollama</code> and point to your local Ollama instance without requiring an external API key.
            </p>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconAlertTriangle size={16} className="text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-surface-400 text-xs space-y-2">
            <IconRefreshCw size={20} className="animate-spin text-primary-400" />
            <span>Loading conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          /* Empty State with Starter Prompts */
          <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600/30 to-indigo-600/30 border border-primary-500/30 flex items-center justify-center mx-auto shadow-inner">
              <IconSparkles size={28} className="text-primary-400" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-semibold text-surface-100">
                Ask anything about your project
              </h3>
              <p className="text-xs text-surface-400 max-w-md mx-auto leading-relaxed">
                Versora grounded AI retrieves real artifact contents, Git commits, relationship links, review requests, and task issues before answering.
              </p>
            </div>

            {/* Quick action buttons */}
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button
                onClick={() => onTriggerQuickAction('project-summary')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 border border-surface-700 text-xs text-surface-200 transition-colors shadow-sm"
              >
                <IconSparkles size={14} className="text-primary-400" />
                <span>Project Summary</span>
              </button>
              <button
                onClick={() => onTriggerQuickAction('explain-impact')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 border border-surface-700 text-xs text-surface-200 transition-colors shadow-sm"
              >
                <IconActivity size={14} className="text-purple-400" />
                <span>Explain Impact</span>
              </button>
              <button
                onClick={() => onTriggerQuickAction('review-assistance')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 border border-surface-700 text-xs text-surface-200 transition-colors shadow-sm"
              >
                <IconTasks size={14} className="text-emerald-400" />
                <span>Review Assistance</span>
              </button>
            </div>

            {/* Starter prompt cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-4 text-left">
              {STARTER_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(item.prompt)}
                  className="p-3.5 rounded-xl bg-surface-850/60 hover:bg-surface-800/90 border border-surface-800 hover:border-primary-500/40 transition-all text-left group shadow-sm flex flex-col justify-between"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {item.icon}
                    <span className="text-xs font-semibold text-surface-200 group-hover:text-primary-300">
                      {item.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-surface-400 line-clamp-2 leading-relaxed">
                    {item.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message Bubbles */
          <div className="max-w-3xl mx-auto space-y-1">
            {messages.map((msg) => (
              <AssistantMessageBubble
                key={msg.id}
                message={msg}
                onNavigateToArtifact={onNavigateToArtifact}
                onNavigateToCommit={onNavigateToCommit}
                onNavigateToTask={onNavigateToTask}
                onNavigateToReview={onNavigateToReview}
              />
            ))}

            {/* Thinking / Sending indicator */}
            {isSending && (
              <div className="flex gap-3 my-4">
                <div className="w-9 h-9 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 flex-shrink-0 animate-pulse">
                  <IconSparkles size={18} />
                </div>
                <div className="rounded-2xl rounded-tl-none px-4 py-3 bg-surface-800 border border-surface-700/80 text-surface-300 text-xs flex items-center gap-2 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" />
                  <span
                    className="w-2 h-2 rounded-full bg-primary-400 animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-primary-400 animate-bounce"
                    style={{ animationDelay: '0.4s' }}
                  />
                  <span className="ml-2 text-[11px] text-surface-400">
                    Retrieving project evidence & analyzing context...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className="p-4 border-t border-surface-800 bg-surface-900/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Quick-Action Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
            <span className="text-surface-500 font-medium mr-1 flex-shrink-0">Quick Actions:</span>
            <button
              onClick={() => onTriggerQuickAction('project-summary')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white border border-surface-700/80 transition-colors flex-shrink-0"
            >
              <IconSparkles size={12} className="text-primary-400" />
              <span>Project Summary</span>
            </button>
            <button
              onClick={() => onTriggerQuickAction('explain-impact')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white border border-surface-700/80 transition-colors flex-shrink-0"
            >
              <IconActivity size={12} className="text-purple-400" />
              <span>Explain Impact</span>
            </button>
            <button
              onClick={() => onTriggerQuickAction('review-assistance')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white border border-surface-700/80 transition-colors flex-shrink-0"
            >
              <IconTasks size={12} className="text-emerald-400" />
              <span>Review Assistance</span>
            </button>
          </div>

          {/* Prompt Form */}
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 bg-surface-800/90 rounded-2xl border border-surface-700/90 p-2 shadow-inner focus-within:border-primary-500 transition-colors"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this project... (Enter to send, Shift+Enter for newline)"
              rows={1}
              disabled={isSending}
              className="flex-1 max-h-36 resize-none bg-transparent px-2 py-1.5 text-sm text-surface-100 placeholder-surface-500 focus:outline-none leading-relaxed"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className={`p-2.5 rounded-xl transition-all shadow-sm flex-shrink-0 ${
                input.trim() && !isSending
                  ? 'bg-primary-600 hover:bg-primary-500 text-white cursor-pointer hover:scale-105 active:scale-95'
                  : 'bg-surface-700/60 text-surface-500 cursor-not-allowed'
              }`}
              title="Send message"
            >
              {isSending ? (
                <IconRefreshCw size={16} className="animate-spin text-surface-400" />
              ) : (
                <IconSend size={16} />
              )}
            </button>
          </form>
          <div className="text-[10px] text-surface-500 text-center">
            Responses are strictly grounded in this project's accessible files, Git commits, tasks, and reviews.
          </div>
        </div>
      </div>
    </div>
  );
};
