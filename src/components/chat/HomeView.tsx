import { useEffect, useState } from "react";
import { loadCustomization } from "../../lib/customization";
import {
  ChatCircleText,
  Detective,
  ListChecks,
  Translate,
} from "@phosphor-icons/react";
import type { SpeechLanguageCode } from "../../lib/artifacts";
import type { InputMode } from "../../types/onyx";
import { OnyxOrb } from "../common/OnyxOrb";

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
  const [ambientGlow, setAmbientGlow] = useState(() => loadCustomization().ambientGlow);
  useEffect(() => {
    const sync = () => setAmbientGlow(loadCustomization().ambientGlow);
    window.addEventListener("onyx-customization-updated", sync);
    return () => window.removeEventListener("onyx-customization-updated", sync);
  }, []);

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center px-6 pt-14 pb-6">
      {/* Subtle Top Warm Ambient Glow */}
      {ambientGlow && (
        <div
          aria-hidden="true"
          className="onyx-ambient-top pointer-events-none fixed inset-x-0 top-0 h-72"
        />
      )}

      <div className="relative z-10 flex w-full flex-col items-center text-center">
        {/* Solar Eclipse / 3D Amber Orb */}
        <div className="onyx-spring-in" style={{ animationDelay: "0ms" }}>
          <OnyxOrb size="hero" animate />
        </div>

        {/* Minimal Greeting Pill */}
        <div
          style={{ animationDelay: "80ms" }}
          className="onyx-bento-card-subtle onyx-spring-in mt-7 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: "var(--onyx-accent)",
              boxShadow: "0 0 8px rgba(var(--onyx-accent-rgb), 0.9)",
            }}
          />
          <span className="font-sans text-xs font-medium text-zinc-200">
            Hello, {greetingName}
          </span>
        </div>

        <h1
          style={{ animationDelay: "140ms" }}
          className="mt-4 max-w-[330px] bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text font-sans text-[28px] font-semibold leading-[1.16] tracking-[-0.03em] text-transparent text-balance sm:max-w-[440px] sm:text-4xl onyx-spring-in"
        >
          How can I assist you today?
        </h1>

        {isTemporaryChat && (
          <p
            style={{ animationDelay: "180ms" }}
            className="mt-3 inline-flex items-center justify-center gap-1.5 font-mono text-[11px] text-zinc-400 onyx-spring-in"
          >
            <Detective size={14} weight="regular" className="shrink-0 text-amber-400" />
            <span>Stealth session · Not saved</span>
          </p>
        )}

        {/* Tactile Obsidian-Amber Mode Switcher */}
        <div
          style={{ animationDelay: "210ms" }}
          className="mt-7 flex items-center justify-center gap-2.5 onyx-spring-in"
        >
          <div
            role="tablist"
            aria-label="Interaction mode"
            className="onyx-bento-card-subtle relative grid grid-cols-2 rounded-full p-1"
          >
            <div
              aria-hidden="true"
              className={`onyx-accent-btn pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                inputMode === "task" ? "translate-x-full" : "translate-x-0"
              }`}
            />
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === "chat"}
              onClick={() => onChangeInputMode("chat")}
              className={`relative z-10 flex h-8 min-w-[84px] items-center justify-center gap-1.5 rounded-full px-3 font-sans text-xs font-semibold whitespace-nowrap active:scale-[0.95] transition-colors duration-150 ${
                inputMode === "chat" ? "text-[#09090B]" : "text-zinc-400 hover:text-white"
              }`}
            >
              <ChatCircleText size={14} weight="bold" />
              <span>Chat</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === "task"}
              onClick={() => onChangeInputMode("task")}
              className={`relative z-10 flex h-8 min-w-[84px] items-center justify-center gap-1.5 rounded-full px-3 font-sans text-xs font-semibold whitespace-nowrap active:scale-[0.95] transition-colors duration-150 ${
                inputMode === "task" ? "text-[#09090B]" : "text-zinc-400 hover:text-white"
              }`}
            >
              <ListChecks size={14} weight="bold" />
              <span>Task</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleSpeechLang}
            aria-label={`Switch dictation language (current: ${
              speechLang === "en-US" ? "English" : "Bangla"
            })`}
            className="onyx-bento-card-subtle flex h-10 items-center gap-1.5 rounded-full px-3.5 font-mono text-xs font-medium text-zinc-200 hover:text-white active:scale-[0.95] transition-transform duration-150"
          >
            <Translate size={14} weight="regular" style={{ color: "var(--onyx-accent)" }} />
            <span>{speechLang === "en-US" ? "EN" : "BN"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
