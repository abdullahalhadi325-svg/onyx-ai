import { useEffect, useRef } from 'react';
import {
  CheckSquare,
  Detective,
  Image as ImageIcon,
  Paperclip,
  Square,
} from '@phosphor-icons/react';
import type {
  ChatMessage,
  EngineMode,
  InputMode,
  PersonaId,
  RoutingModeId,
} from '../../types/onyx';
import { getThinkingStatusLabel } from '../../lib/artifacts';
import {
  getPersonaOption,
  getRoutingModeOption,
  getTaskCompletionStats,
} from '../../utils/onyxState';
import { MessageRenderer, OnyxThinkingPulse } from './MessageRenderer';

interface ChatThreadProps {
  messages: ChatMessage[];
  latestRevealingMessageId: string | null;
  isTemporaryChat: boolean;
  isSending: boolean;
  statusMessage?: string | null;
  activeEngineMode: EngineMode;
  activeRoutingMode: RoutingModeId;
  activePersona: PersonaId;
  activeInputMode: InputMode;
  onToggleTaskStep: (messageId: string, stepId: string) => void;
  onRegenerateMessage: (assistantMessageId: string) => void;
  onBranchFromMessage: (messageId: string) => void;
}

export function ChatThread({
  messages,
  latestRevealingMessageId,
  isTemporaryChat,
  isSending,
  statusMessage,
  activeEngineMode,
  activeRoutingMode,
  activePersona,
  activeInputMode,
  onToggleTaskStep,
  onRegenerateMessage,
  onBranchFromMessage,
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [messages.length, isSending]);

  const activeModeLabel =
    activeEngineMode === 'local'
      ? 'Local AI'
      : getRoutingModeOption(activeRoutingMode).label;
  const activePersonaName = getPersonaOption(activePersona).name;
  const thinkingStatusLabel =
    statusMessage ||
    getThinkingStatusLabel(
      activeRoutingMode,
      activeInputMode,
      activeEngineMode
    );

  return (
    <div className="relative z-10 mx-auto w-full max-w-[680px] flex-1 px-4 pt-20 pb-8">
      {isTemporaryChat && (
        <div className="mb-6 flex items-center justify-center gap-2 rounded-2xl bg-[#111116] px-3.5 py-2.5 text-xs text-zinc-400">
          <Detective
            size={15}
            weight="regular"
            className="shrink-0 text-blue-300"
          />
          <span>Temporary chat active · Not saved to local history or cloud</span>
        </div>
      )}

      <div className="space-y-7" role="log" aria-label="Conversation messages">
        {messages.map((message) => {
          const modeLabel =
            message.engine === 'local'
              ? 'Local AI'
              : getRoutingModeOption(message.mode).label;
          const personaName = getPersonaOption(message.persona).name;

          if (message.role === 'user') {
            return (
              <div key={message.id} className="flex flex-col items-end">
                <div className="max-w-[88%] overflow-hidden rounded-2xl bg-[#14151C] px-4 py-3 text-sm leading-relaxed text-white sm:max-w-[80%] sm:text-base">
                  {message.attachedImagePreview && (
                    <img
                      src={message.attachedImagePreview}
                      alt={message.toolsUsed?.attachedFileName || 'Attached visual'}
                      className="mb-2.5 max-h-48 w-full rounded-xl object-cover"
                    />
                  )}
                  <p className="break-words whitespace-pre-wrap text-pretty">
                    {message.content}
                  </p>
                  {message.toolsUsed &&
                    (message.toolsUsed.createImage ||
                      message.toolsUsed.attachedFileName) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-400">
                        {message.toolsUsed.createImage && (
                          <span className="inline-flex items-center gap-1">
                            <ImageIcon size={13} weight="regular" className="shrink-0 text-blue-400" />
                            <span>Create Image</span>
                          </span>
                        )}
                        {message.toolsUsed.attachedFileName && (
                          <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-0.5">
                            <Paperclip size={13} weight="regular" className="shrink-0 text-zinc-400" />
                            <span className="min-w-0 max-w-full truncate break-all">
                              {message.toolsUsed.attachedFileName}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                </div>

                {/* Subtle user metadata timestamp */}
                <div className="mt-1 flex items-center gap-1.5 px-1 font-mono text-[11px] text-zinc-500 tabular-nums">
                  <span>{message.inputMode === 'task' ? 'Task' : 'Chat'}</span>
                  {message.timestamp && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{message.timestamp}</span>
                    </>
                  )}
                </div>
              </div>
            );
          }

          if (message.isStreamingLive && message.content.length === 0) {
            return null;
          }

          const taskStats = message.taskSteps
            ? getTaskCompletionStats(message.taskSteps)
            : null;

          return (
            <article key={message.id} className="min-w-0 max-w-full space-y-2.5">
              {/* Quiet borderless metadata line */}
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-zinc-500 tabular-nums">
                <span className="font-medium text-zinc-300">{modeLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{personaName}</span>
                {message.timestamp && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{message.timestamp}</span>
                  </>
                )}
              </div>

              <MessageRenderer
                messageId={message.id}
                content={message.content}
                mode={message.mode}
                persona={message.persona}
                engine={message.engine}
                timestamp={message.timestamp}
                thinkingLog={message.thinkingSummary}
                thinkingDuration={message.thinkingDuration}
                mediaCards={message.mediaCards}
                sources={message.sources}
                generatedImage={message.generatedImage}
                shouldAnimateReveal={
                  message.id === latestRevealingMessageId &&
                  !message.isStreamingLive
                }
                isStreamingLive={Boolean(message.isStreamingLive)}
                onRegenerate={() => onRegenerateMessage(message.id)}
                onBranchChat={() => onBranchFromMessage(message.id)}
              />

              {/* Autonomous checklist rendered when structured steps are present */}
              {message.taskSteps && taskStats && (
                <div className="rounded-2xl bg-[#111116] p-2">
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <span className="text-xs font-medium text-zinc-300">
                      Autonomous checklist
                    </span>
                    <span className="font-mono text-xs text-zinc-500 tabular-nums">
                      {taskStats.completed}/{taskStats.total} ·{' '}
                      {taskStats.percent}%
                    </span>
                  </div>

                  <div className="space-y-1">
                    {message.taskSteps.map((step) => (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => onToggleTaskStep(message.id, step.id)}
                        aria-pressed={step.done}
                        className={`flex min-h-[44px] w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left active:scale-[0.97] transition-colors duration-150 ${
                          step.done
                            ? 'bg-[#0C0C10] text-zinc-500 hover:bg-[#17171F]'
                            : 'bg-[#17171F] text-white hover:bg-[#1F1F2B]'
                        }`}
                      >
                        {step.done ? (
                          <CheckSquare
                            size={18}
                            weight="fill"
                            className="mt-0.5 shrink-0 text-blue-400"
                          />
                        ) : (
                          <Square
                            size={18}
                            weight="regular"
                            className="mt-0.5 shrink-0 text-zinc-400"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-medium leading-snug ${
                              step.done
                                ? 'line-through text-zinc-500'
                                : 'text-white'
                            }`}
                          >
                            {step.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-zinc-400">
                            {step.detail}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {/* Animated Mini Onyx Orb + Typing Wave Indicator */}
        {isSending &&
          !messages.some(
            (msg) => msg.isStreamingLive && msg.content.length > 0
          ) && (
            <OnyxThinkingPulse
              statusLabel={thinkingStatusLabel}
              modeLabel={activeModeLabel}
              personaName={activePersonaName}
            />
          )}
      </div>

      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
