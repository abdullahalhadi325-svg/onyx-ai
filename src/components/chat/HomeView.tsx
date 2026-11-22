import {
  ChatCircleText,
  Detective,
  ListChecks,
  Translate,
} from '@phosphor-icons/react';
import type { SpeechLanguageCode } from '../../lib/artifacts';
import type { InputMode } from '../../types/onyx';
import { OnyxOrb } from '../common/OnyxOrb';

interface HomeViewProps {
  greetingName: string;
  inputMode: InputMode;
  onChangeInputMode: (mode: InputMode) => void;
  speechLang: SpeechLanguageCode;
  onToggleSpeechLang: () => void;
  isTemporaryChat: boolean;
}

export function HomeView({
  greetingName,
  inputMode,
  onChangeInputMode,
  speechLang,
  onToggleSpeechLang,
  isTemporaryChat,
}: HomeViewProps) {
  return (
    <div className="onyx-hud-grid relative z-10 mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center px-6 pt-14 pb-6">
      <div className="flex w-full flex-col items-center text-center">
        {/* Living Jarvis HUD Sapphire Energy Orb */}
        <div className="onyx-spring-in" style={{ animationDelay: '70ms' }}>
          <OnyxOrb size="hero" animate />
        </div>

        {/* Crisp Greeting + Architectural Geometric Sans Heading */}
        <p
          style={{ animationDelay: '130ms' }}
          className="mt-8 font-mono text-xs font-medium tracking-[0.14em] text-sky-300/90 uppercase onyx-spring-in"
        >
          Hello, {greetingName}
        </p>

        <h1
          style={{ animationDelay: '180ms' }}
          className="mt-2.5 max-w-[330px] bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text font-sans text-[28px] font-semibold leading-[1.14] tracking-[-0.03em] text-transparent text-balance sm:max-w-[460px] sm:text-4xl onyx-spring-in"
        >
          Ready for your command.
        </h1>

        {isTemporaryChat && (
          <p
            style={{ animationDelay: '210ms' }}
            className="mt-3 inline-flex items-center justify-center gap-1.5 font-mono text-[11px] text-zinc-400 onyx-spring-in"
          >
            <Detective
              size={14}
              weight="regular"
              className="shrink-0 text-sky-400"
            />
            <span>Memory disabled · Not saved to history</span>
          </p>
        )}

        {/* Liquid Glass Mode Switcher + Language Pill */}
        <div
          style={{ animationDelay: '240ms' }}
          className="mt-8 flex items-center justify-center gap-2.5 onyx-spring-in"
        >
          <div
            role="tablist"
            aria-label="Interaction mode"
            className="onyx-liquid-glass relative grid grid-cols-2 rounded-full p-1"
          >
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-b from-sky-500/90 to-blue-600/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(37,99,235,0.45)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                inputMode === 'task' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === 'chat'}
              onClick={() => onChangeInputMode('chat')}
              className={`relative z-10 flex h-8 min-w-[82px] items-center justify-center gap-1.5 rounded-full px-3 font-sans text-xs font-medium whitespace-nowrap active:scale-[0.95] transition-transform duration-150 ${
                inputMode === 'chat'
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ChatCircleText size={14} weight="regular" />
              <span>Chat</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === 'task'}
              onClick={() => onChangeInputMode('task')}
              className={`relative z-10 flex h-8 min-w-[82px] items-center justify-center gap-1.5 rounded-full px-3 font-sans text-xs font-medium whitespace-nowrap active:scale-[0.95] transition-transform duration-150 ${
                inputMode === 'task'
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ListChecks size={14} weight="regular" />
              <span>Task</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleSpeechLang}
            aria-label={`Switch dictation language (current: ${
              speechLang === 'en-US' ? 'English' : 'Bangla'
            })`}
            className="onyx-liquid-glass flex h-10 items-center gap-1.5 rounded-full px-3.5 font-mono text-xs font-medium text-zinc-200 hover:border-sky-400/40 hover:text-white active:scale-[0.95] transition-transform duration-150"
          >
            <Translate size={14} weight="regular" className="text-sky-400" />
            <span>{speechLang === 'en-US' ? 'EN' : 'BN'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
