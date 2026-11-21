import { useEffect, useRef } from 'react';
import {
  CheckSquare,
  Detective,
  FilePdf,
  Image as ImageIcon,
  Paperclip,
  Square,
} from '@phosphor-icons/react';
import type {
  ChatMessage,
  InputMode,
  PendingChatError,
  PersonaId,
  RoutingModeId,
} from '../../types/onyx';
import {
  getThinkingStatusLabel,
  sanitizeAssistantErrorMessage,
} from '../../lib/artifacts';
import {
  getPersonaOption,
  getRoutingModeOption,
  getTaskCompletionStats,
} from '../../utils/onyxState';
import {
  MessageRenderer,
  OnyxErrorCard,
  OnyxThinkingPulse,
} from './MessageRenderer';

interface ChatThreadProps {
  messages: ChatMessage[];
  latestRevealingMessageId: string | null;
  isTemporaryChat: boolean;
  isSending: boolean;
  activeRoutingMode: RoutingModeId;
  activePersona: PersonaId;
  activeInputMode: InputMode;
  pendingError: PendingChatError | null;
  onRetry: () => void;
  onToggleTaskStep: (messageId: string, stepId: string) => void;
  onRegenerateMessage: (assistantMessageId: string) => void;
  onSaveMessageToVault: (message: ChatMessage) => void;
  onBranchFromMessage: (messageId: string) => void;
  onExportMessagePdf: (message: ChatMessage) => void;
}

export function ChatThread({
  messages,
  latestRevealingMessageId,
  isTemporaryChat,
  isSending,
  activeRoutingMode,
  activePersona,
  activeInputMode,
  pendingError,
  onRetry,
  onToggleTaskStep,
  onRegenerateMessage,
  onSaveMessageToVault,
  onBranchFromMessage,
  onExportMessagePdf,
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isSending, pendingError]);

  const activeModeLabel = getRoutingModeOption(activeRoutingMode).label;
  const activePersonaName = getPersonaOption(activePersona).name;
  const thinkingStatusLabel = getThinkingStatusLabel(
    activeRoutingMode,
    activeInputMode
  );

  return (
    <div className="relative z-10 mx-auto w-full max-w-[680px] flex-1 px-4 pt-20 pb-6">
      {isTemporaryChat && (
        <div className="mb-6 flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#131209] px-3.5 py-2.5 text-xs text-white/65">
          <Detective
            size={15}
            weight="regular"
            className="shrink-0 text-white/75"
          />
          <span>Temporary chat active · Not saved to Supabase or vaults</span>
        </div>
      )}

      <div className="space-y-6" role="log" aria-label="Conversation messages">
        {messages.map((message) => {
          const modeLabel = getRoutingModeOption(message.mode).label;
          const personaName = getPersonaOption(message.persona).name;

          if (message.role === 'user') {
            return (
              <div key={message.id} className="flex flex-col items-end">
                <div className="max-w-[88%] rounded-2xl border border-white/[0.08] bg-[#1F1F1F] px-4 py-3 text-sm leading-relaxed text-white sm:max-w-[80%] sm:text-base">
                  <p className="whitespace-pre-wrap text-pretty">
                    {message.content}
                  </p>
                  {message.toolsUsed &&
                    (message.toolsUsed.generatePdf ||
                      message.toolsUsed.createImage ||
                      message.toolsUsed.attachedFileName) && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-white/55">
                        {message.toolsUsed.generatePdf && (
                          <span className="inline-flex items-center gap-1">
                            <FilePdf size={13} weight="regular" />
                            <span>PDF to Telegram</span>
                          </span>
                        )}
                        {message.toolsUsed.createImage && (
                          <span className="inline-flex items-center gap-1">
                            <ImageIcon size={13} weight="regular" />
                            <span>Create Image</span>
                          </span>
                        )}
                        {message.toolsUsed.attachedFileName && (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip size={13} weight="regular" />
                            <span>{message.toolsUsed.attachedFileName}</span>
                          </span>
                        )}
                      </div>
                    )}
                </div>

                {/* Tight user metadata timestamp */}
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

          const taskStats = message.taskSteps
            ? getTaskCompletionStats(message.taskSteps)
            : null;

          return (
            <article key={message.id} className="min-w-0 max-w-full space-y-3">
              {/* Quiet unboxed metadata header */}
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-white/50 tabular-nums">
                <span className="font-medium text-white/80">{modeLabel}</span>
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
                timestamp={message.timestamp}
                thinkingLog={message.thinkingSummary}
                thinkingDuration={message.thinkingDuration}
                mediaCards={message.mediaCards}
                sources={message.sources}
                pdfVault={message.pdfVault}
                generatedImage={message.generatedImage}
                shouldAnimateReveal={message.id === latestRevealingMessageId}
                onRegenerate={() => onRegenerateMessage(message.id)}
                onSaveToVault={() => onSaveMessageToVault(message)}
                onBranchChat={() => onBranchFromMessage(message.id)}
                onExportPdf={() => onExportMessagePdf(message)}
              />

              {/* Autonomous checklist rendered when structured steps are present */}
              {message.taskSteps && taskStats && (
                <div className="rounded-2xl border border-white/[0.08] bg-[#181818] p-2">
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <span className="text-xs font-medium text-white/75">
                      Autonomous checklist
                    </span>
                    <span className="font-mono text-xs text-white/55 tabular-nums">
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
                        className={`flex min-h-[44px] w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-transform duration-150 ${
                          step.done
                            ? 'bg-[#131209] text-white/60 hover:bg-[#272727]'
                            : 'bg-[#1F1F1F] text-white hover:bg-[#313131]'
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
                            className="mt-0.5 shrink-0 text-white/55"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-medium leading-snug ${
                              step.done
                                ? 'line-through text-white/55'
                                : 'text-white'
                            }`}
                          >
                            {step.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-white/45">
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

        {/* Glowing Mini Onyx Orb Thinking Indicator */}
        {isSending && (
          <OnyxThinkingPulse
            statusLabel={thinkingStatusLabel}
            modeLabel={activeModeLabel}
            personaName={activePersonaName}
          />
        )}

        {/* Clean Crimson Error Card with single Retry button + tiny diagnostic line */}
        {pendingError && !isSending && (
          <OnyxErrorCard
            message={sanitizeAssistantErrorMessage(pendingError.message)}
            diagnostic={pendingError.diagnostic}
            onRetry={onRetry}
          />
        )}
      </div>

      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
