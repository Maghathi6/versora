import React, { useState } from 'react';
import { AssistantMessage, EvidenceReference } from '../../types/assistant';
import {
  IconSparkles,
  IconGitCommit,
  IconTasks,
  IconReviews,
  IconFileText,
  IconAlertTriangle,
  IconCopy,
  IconCheck,
} from '../common/Icons';

interface AssistantMessageBubbleProps {
  message: AssistantMessage;
  onNavigateToArtifact?: (pathOrId: string) => void;
  onNavigateToCommit?: (hash: string) => void;
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToReview?: (reviewId: string) => void;
}

export const AssistantMessageBubble: React.FC<AssistantMessageBubbleProps> = ({
  message,
  onNavigateToArtifact,
  onNavigateToCommit,
  onNavigateToTask,
  onNavigateToReview,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSourceClick = (source: EvidenceReference) => {
    if (source.type === 'artifact' && onNavigateToArtifact) {
      onNavigateToArtifact(source.identifier);
    } else if (source.type === 'commit' && onNavigateToCommit) {
      onNavigateToCommit(source.identifier);
    } else if (source.type === 'task' && onNavigateToTask) {
      onNavigateToTask(source.identifier);
    } else if (source.type === 'review' && onNavigateToReview) {
      onNavigateToReview(source.identifier);
    }
  };

  const formatSourceIcon = (type: EvidenceReference['type']) => {
    switch (type) {
      case 'artifact':
        return <IconFileText size={14} className="text-primary-500 flex-shrink-0" />;
      case 'commit':
        return <IconGitCommit size={14} className="text-amber-500 flex-shrink-0" />;
      case 'task':
        return <IconTasks size={14} className="text-emerald-500 flex-shrink-0" />;
      case 'review':
        return <IconReviews size={14} className="text-purple-500 flex-shrink-0" />;
      default:
        return <IconSparkles size={14} className="text-primary-400 flex-shrink-0" />;
    }
  };

  return (
    <div
      className={`flex gap-3 my-4 group ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar Icon */}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-semibold shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-primary-600 to-indigo-600 text-white'
            : 'bg-gradient-to-br from-amber-500/20 to-primary-500/20 text-primary-400 border border-primary-500/30'
        }`}
      >
        {isUser ? 'U' : <IconSparkles size={18} className="text-primary-400" />}
      </div>

      {/* Message Body */}
      <div
        className={`max-w-[85%] sm:max-w-[78%] flex flex-col ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`relative rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all ${
            isUser
              ? 'bg-primary-600 text-white rounded-tr-none'
              : 'bg-surface-800/90 text-surface-100 border border-surface-700/80 rounded-tl-none shadow-black/20'
          }`}
        >
          {/* Action buttons (Copy) */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <button
              onClick={handleCopy}
              className={`p-1 rounded text-xs transition-colors ${
                isUser
                  ? 'hover:bg-primary-700 text-primary-200'
                  : 'hover:bg-surface-700 text-surface-400 hover:text-surface-200'
              }`}
              title="Copy message text"
            >
              {copied ? <IconCheck size={14} className="text-emerald-400" /> : <IconCopy size={14} />}
            </button>
          </div>

          {/* Formatted Content */}
          <div className="whitespace-pre-wrap font-sans break-words pr-5">
            {message.content}
          </div>

          {/* Uncertainty Note Banner */}
          {message.uncertaintyNote && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-2">
              <IconAlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <span>{message.uncertaintyNote}</span>
            </div>
          )}

          {/* Evidence and Grounding Sources */}
          {isAssistant && message.sources && message.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-700/60">
              <div className="text-[11px] font-medium uppercase tracking-wider text-surface-400 mb-1.5 flex items-center gap-1">
                <span>Verified Sources ({message.sources.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {message.sources.map((src, idx) => (
                  <button
                    key={`${src.type}-${src.identifier}-${idx}`}
                    onClick={() => handleSourceClick(src)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-900/80 hover:bg-surface-700 border border-surface-700/80 hover:border-primary-500/50 text-xs text-surface-200 transition-all hover:scale-[1.02] text-left max-w-full truncate group/chip"
                    title={`View ${src.type}: ${src.title} (${src.identifier})`}
                  >
                    {formatSourceIcon(src.type)}
                    <span className="font-mono text-[11px] text-surface-300 group-hover/chip:text-primary-300 truncate">
                      {src.title || src.identifier}
                    </span>
                    {src.location && (
                      <span className="text-[10px] text-surface-500 truncate max-w-[120px]">
                        {src.location}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timestamp & Metadata */}
        <div className="text-[10px] text-surface-400 mt-1 px-1 flex items-center gap-2">
          <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isAssistant && message.metadata && (
            <span className="text-surface-500">• Grounded Analysis</span>
          )}
        </div>
      </div>
    </div>
  );
};
