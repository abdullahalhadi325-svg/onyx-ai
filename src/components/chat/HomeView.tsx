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
    <div className="relative z-10 mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center px-6 pt-16 pb-6">
      <div className="flex w-full flex-col items-center text-center">
        {/* Living Pure CSS/SVG Sapphire Energy Orb */}
        <div className="onyx-fade-up" style={{ animationDelay: '0ms' }}>
          <OnyxOrb size="hero" animate />
        </div>

        {/* Muted Sans Greeting + Claude-style Editorial Serif Display Heading */}
        <p
          style={{ animationDelay: '80ms' }}
          className="mt-7 font-sans text-sm font-normal text-zinc-400 onyx-fade-up"
        >
          Hello {greetingName}
        </p>

        <h1
          style={{ animationDelay: '140ms' }}
          className="mt-2 max-w-[340px] font-serif text-3xl font-medium leading-[1.16] tracking-tight text-white text-balance sm:max-w-[460px] sm:text-4xl onyx-fade-up"
        >
          How can I help you today?
        </h1>

        {isTemporaryChat && (
          <p
            style={{ animationDelay: '175ms' }}
            className="mt-3 inline-flex items-center justify-center gap-1.5 font-sans text-xs text-zinc-400 onyx-fade-up"
          >
            <Detective
              size={14}
              weight="regular"
              className="shrink-0 text-zinc-300"
            />
            <span>Temporary chat · Not saved to history</span>
          </p>
        )}

        {/* Single Compact Chat | Task Pill + Tiny EN/BN Toggle */}
        <div
          style={{ animationDelay: '200ms' }}
          className="mt-7 flex items-center justify-center gap-2 onyx-fade-up"
        >
          <div
            role="tablist"
            aria-label="Interaction mode"
            className="relative grid grid-cols-2 rounded-full border border-white/[0.09] bg-[#111218]/90 p-1"
          >
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#2563EB] shadow-md shadow-blue-600/30 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                inputMode === 'task' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === 'chat'}
              onClick={() => onChangeInputMode('chat')}
              className={`relative z-10 flex h-8 min-w-[78px] items-center justify-center gap-1.5 rounded-full px-3 font-sans text-xs font-medium whitespace-nowrap active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 transition-transform duration-150 ${
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
              className={`relative z-10 flex h-8 min-w-[78px] items-center justify-center gap-1.5 rounded-full px-3 font-sans text-xs font-medium whitespace-nowrap active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 transition-transform duration-150 ${
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
            className="flex h-10 items-center gap-1.5 rounded-full border border-white/[0.09] bg-[#111218]/90 px-3 font-sans text-xs font-medium text-zinc-300 hover:border-blue-400/35 hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 transition-transform duration-150"
          >
            <Translate size={14} weight="regular" className="text-blue-400" />
            <span>{speechLang === 'en-US' ? 'EN' : 'BN'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
