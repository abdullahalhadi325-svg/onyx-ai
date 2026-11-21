import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Brain,
  Camera,
  ChatCircleText,
  Check,
  FileArrowUp,
  FilePdf,
  GlobeHemisphereWest,
  Image as ImageIcon,
  Images,
  ListChecks,
  Microphone,
  Paperclip,
  Plus,
  Stop,
  Translate,
  Vault,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import type { SpeechLanguageCode } from '../../lib/artifacts';
import type {
  ActiveTools,
  InputMode,
  MemoryVault,
  RoutingModeId,
} from '../../types/onyx';

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface InputDockProps {
  value: string;
  onChange: (value: string) => void;
  inputMode: InputMode;
  onChangeInputMode: (mode: InputMode) => void;
  speechLang: SpeechLanguageCode;
  onToggleSpeechLang: () => void;
  routingMode: RoutingModeId;
  onSelectRoutingMode: (mode: RoutingModeId) => void;
  activeTools: ActiveTools;
  onToggleGeneratePdf: () => void;
  onToggleCreateImage: () => void;
  onAttachFile: (fileName: string | null, previewUrl?: string | null) => void;
  isPersonalIntelligenceEnabled: boolean;
  onTogglePersonalIntelligence: () => void;
  vaults: MemoryVault[];
  onSelectVault: (vault: MemoryVault) => void;
  onSubmit: () => void;
  isSending?: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

const WAVEFORM_HEIGHTS = [14, 22, 18, 26, 16, 24, 14];

export function InputDock({
  value,
  onChange,
  inputMode,
  onChangeInputMode,
  speechLang,
  onToggleSpeechLang,
  routingMode,
  onSelectRoutingMode,
  activeTools,
  onToggleGeneratePdf,
  onToggleCreateImage,
  onAttachFile,
  isPersonalIntelligenceEnabled,
  onTogglePersonalIntelligence,
  vaults,
  onSelectVault,
  onSubmit,
  isSending = false,
  textareaRef,
}: InputDockProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseValueRef = useRef<string>('');
  const latestValueRef = useRef<string>(value);
  const objectUrlRef = useRef<string | null>(null);

  latestValueRef.current = value;

  // Auto-grow textarea height smoothly up to 160px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 160);
    el.style.height = `${Math.max(nextHeight, 40)}px`;
  }, [value, textareaRef, isListening]);

  // Clean up SpeechRecognition and object URLs on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup errors
        }
        recognitionRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  // Close sheet on Escape
  useEffect(() => {
    if (!isSheetOpen) {
      setShowVaultPicker(false);
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsSheetOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSheetOpen]);

  const canSend =
    !isSending &&
    (value.trim().length > 0 ||
      activeTools.attachedFileName !== null ||
      activeTools.generatePdf ||
      activeTools.createImage);

  const isDeepResearchOn = routingMode === 'deep-research';
  const hasActiveTools =
    activeTools.generatePdf ||
    activeTools.createImage ||
    Boolean(activeTools.attachedFileName);

  function stopVoiceRecognition() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error if already inactive
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }

  function startVoiceRecognition(lang: SpeechLanguageCode) {
    setVoiceError(null);
    const speechWindow = window as unknown as WindowWithSpeechRecognition;
    const RecognitionCtor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      setVoiceError(
        'Voice dictation is not supported in this browser. Try Chrome, Edge, or Android WebView.'
      );
      setIsListening(false);
      return;
    }

    try {
      const recognition = new RecognitionCtor();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;

      baseValueRef.current = latestValueRef.current.trim();

      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = 0; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = result[0]?.transcript ?? '';
          if (result.isFinal) {
            finalChunk += transcript;
          } else {
            interimChunk += transcript;
          }
        }

        const spoken = `${finalChunk}${interimChunk}`.trim();
        const prefix = baseValueRef.current;
        const combined =
          prefix && spoken ? `${prefix} ${spoken}` : spoken || prefix;
        onChange(combined);
      };

      recognition.onerror = (event) => {
        if (
          event.error === 'not-allowed' ||
          event.error === 'service-not-allowed'
        ) {
          setVoiceError('Microphone permission was denied.');
        } else if (event.error === 'no-speech') {
          setVoiceError('No speech detected. Tap the microphone to try again.');
        } else if (event.error !== 'aborted') {
          setVoiceError(`Voice input paused (${event.error}).`);
        }
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setVoiceError('Could not start voice dictation.');
      setIsListening(false);
      recognitionRef.current = null;
    }
  }

  function handleVoiceToggle() {
    if (isListening) {
      stopVoiceRecognition();
    } else {
      startVoiceRecognition(speechLang);
    }
  }

  function handleToggleSpeechLang() {
    const nextLang: SpeechLanguageCode =
      speechLang === 'en-US' ? 'bn-BD' : 'en-US';
    onToggleSpeechLang();
    setVoiceError(null);

    if (isListening) {
      stopVoiceRecognition();
      window.setTimeout(() => startVoiceRecognition(nextLang), 120);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        if (isListening) {
          stopVoiceRecognition();
        }
        onSubmit();
      }
    }
  }

  function handleMediaSelected(
    event: React.ChangeEvent<HTMLInputElement>,
    isImagePicker: boolean
  ) {
    const file = event.target.files?.[0];
    if (file) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const isImg = isImagePicker || file.type.startsWith('image/');
      let nextPreview: string | null = null;
      if (isImg) {
        nextPreview = URL.createObjectURL(file);
        objectUrlRef.current = nextPreview;
      }
      onAttachFile(file.name, nextPreview);
    }
    event.target.value = '';
    setIsSheetOpen(false);
  }

  function handleClearAttachment() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    onAttachFile(null, null);
  }

  function handleDispatch() {
    if (isListening) {
      stopVoiceRecognition();
    }
    onSubmit();
  }

  return (
    <>
      <div className="relative z-20 shrink-0 px-3 pt-2 pb-3 sm:px-4 sm:pb-4">
        <div className="mx-auto w-full max-w-[700px] space-y-2">
          {/* Voice error inline feedback */}
          {voiceError && (
            <div
              role="status"
              className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#131209] px-3 py-2 text-xs text-white/80"
            >
              <span className="flex min-w-0 items-center gap-2">
                <WarningCircle
                  size={15}
                  weight="regular"
                  className="shrink-0 text-white/75"
                />
                <span className="truncate">{voiceError}</span>
              </span>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                aria-label="Dismiss voice notice"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-[#313131] hover:text-white active:scale-[0.98]"
              >
                <X size={13} weight="bold" />
              </button>
            </div>
          )}

          {/* Native Camera / Photos Thumbnail Preview Strip */}
          {activeTools.attachedFileName && activeTools.attachedPreviewUrl && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#181818]/90 p-2 backdrop-blur-xl">
              <img
                src={activeTools.attachedPreviewUrl}
                alt={activeTools.attachedFileName}
                className="h-14 w-14 shrink-0 rounded-xl border border-white/[0.08] object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-white">
                  {activeTools.attachedFileName}
                </div>
                <div className="mt-0.5 font-mono text-xs text-white/45">
                  Image ready to attach
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearAttachment}
                aria-label={`Remove ${activeTools.attachedFileName}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#272727] text-white/75 hover:bg-[#313131] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <X size={15} weight="bold" />
              </button>
            </div>
          )}

          {/* Active Tool Chips (only shown when a tool or file is attached) */}
          {hasActiveTools && (
            <div className="flex flex-wrap items-center gap-1.5 px-1">
              {activeTools.generatePdf && (
                <button
                  type="button"
                  onClick={onToggleGeneratePdf}
                  aria-label="Remove Generate PDF to Telegram"
                  className="flex h-8 items-center gap-1.5 rounded-full border border-blue-400/25 bg-[#121622] px-3 font-mono text-xs text-blue-100 hover:bg-[#1A2133] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 transition-transform duration-150"
                >
                  <FilePdf size={14} weight="regular" />
                  <span>PDF</span>
                  <X size={12} weight="bold" className="text-blue-300/70" />
                </button>
              )}

              {activeTools.createImage && (
                <button
                  type="button"
                  onClick={onToggleCreateImage}
                  aria-label="Remove Create Image"
                  className="flex h-8 items-center gap-1.5 rounded-full border border-blue-400/25 bg-[#121622] px-3 font-mono text-xs text-blue-100 hover:bg-[#1A2133] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 transition-transform duration-150"
                >
                  <ImageIcon size={14} weight="regular" />
                  <span>Image · Flux</span>
                  <X size={12} weight="bold" className="text-blue-300/70" />
                </button>
              )}

              {activeTools.attachedFileName && !activeTools.attachedPreviewUrl && (
                <button
                  type="button"
                  onClick={handleClearAttachment}
                  aria-label={`Detach ${activeTools.attachedFileName}`}
                  className="flex h-8 max-w-[200px] items-center gap-1.5 rounded-full border border-white/10 bg-[#1B1E28] px-3 font-mono text-xs text-white/85 hover:bg-[#252936] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-transform duration-150"
                >
                  <Paperclip size={14} weight="regular" className="shrink-0" />
                  <span className="truncate">{activeTools.attachedFileName}</span>
                  <X size={12} weight="bold" className="shrink-0 text-white/50" />
                </button>
              )}
            </div>
          )}

          {/* Luminous Sapphire-Lit Glass Floating Input Pill */}
          <div
            className={`relative border border-blue-300/25 bg-[#121622]/75 p-1.5 shadow-[0_0_34px_rgba(37,99,235,0.22)] backdrop-blur-2xl transition-[border-color,box-shadow] duration-200 focus-within:border-blue-400/60 focus-within:shadow-[0_0_40px_rgba(59,130,246,0.32)] ${
              value.includes('\n') || value.length > 70
                ? 'rounded-3xl'
                : 'rounded-full'
            }`}
          >
            {/* Hidden native capture & file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => handleMediaSelected(event, true)}
              aria-hidden="true"
              tabIndex={-1}
            />
            <input
              ref={photosInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleMediaSelected(event, true)}
              aria-hidden="true"
              tabIndex={-1}
            />
            <input
              ref={filesInputRef}
              type="file"
              className="hidden"
              onChange={(event) => handleMediaSelected(event, false)}
              aria-hidden="true"
              tabIndex={-1}
            />

            {isListening ? (
              /* Live Voice Waveform Morph State */
              <div className="flex min-h-[44px] items-center justify-between gap-2.5 px-1.5">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="flex h-8 shrink-0 items-center gap-1 pl-1"
                  >
                    {WAVEFORM_HEIGHTS.map((heightPx, idx) => (
                      <span
                        key={idx}
                        style={{
                          height: `${heightPx}px`,
                          animationDelay: `${idx * 95}ms`,
                        }}
                        className="w-1 rounded-full bg-[#3B82F6] onyx-waveform-bar"
                      />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">
                      {value.trim() ||
                        `Listening (${speechLang === 'en-US' ? 'English' : 'Bangla'})...`}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={stopVoiceRecognition}
                    aria-label="Stop voice dictation"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#252834] text-white hover:bg-[#303444] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-transform duration-150"
                  >
                    <Stop size={17} weight="fill" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDispatch}
                    disabled={!canSend}
                    aria-label="Send voice message"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-lg shadow-blue-600/25 hover:bg-[#3B82F6] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 disabled:cursor-not-allowed disabled:opacity-45 transition-transform duration-150"
                  >
                    <ArrowUp size={19} weight="bold" />
                  </button>
                </div>
              </div>
            ) : (
              /* Standard Text Input Pill */
              <div className="flex items-end gap-1.5">
                {/* Left '+' Button opening Action Bottom Sheet */}
                <button
                  type="button"
                  onClick={() => setIsSheetOpen(true)}
                  aria-label="Open tool actions"
                  aria-expanded={isSheetOpen}
                  aria-haspopup="dialog"
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 transition-transform duration-150 ${
                    isSheetOpen || hasActiveTools
                      ? 'border border-blue-400/30 bg-[#232838] text-white hover:bg-[#2C3347]'
                      : 'text-zinc-300 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  <Plus
                    size={19}
                    weight="bold"
                    className={`transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isSheetOpen ? 'rotate-45' : 'rotate-0'
                    }`}
                  />
                </button>

                {/* Center: Auto-growing textarea */}
                <div className="flex min-w-0 flex-1 items-center">
                  <label htmlFor="onyx-prompt-input" className="sr-only">
                    Ask anything
                  </label>
                  <textarea
                    id="onyx-prompt-input"
                    ref={textareaRef}
                    rows={1}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      activeTools.createImage
                        ? 'Describe an image...'
                        : inputMode === 'task'
                          ? 'Describe a task...'
                          : 'Ask anything...'
                    }
                    className="max-h-40 min-h-[42px] w-full resize-none bg-transparent py-2.5 pl-1 text-sm leading-5 text-white placeholder:text-zinc-400/80 focus-visible:outline-none sm:text-base sm:leading-6"
                  />
                </div>

                {/* Right: Voice Mic + Sapphire Blue Send */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={handleVoiceToggle}
                    aria-label="Start voice dictation"
                    aria-pressed={isListening}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-300 hover:bg-white/[0.08] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 transition-transform duration-150"
                  >
                    <Microphone size={19} weight="regular" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDispatch}
                    disabled={!canSend}
                    aria-label="Send message"
                    className={`flex h-11 w-11 items-center justify-center rounded-full active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 transition-transform duration-150 ${
                      canSend
                        ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-600/30 hover:bg-[#3B82F6]'
                        : 'cursor-not-allowed border border-white/[0.08] bg-[#222530] text-zinc-500'
                    }`}
                  >
                    <ArrowUp size={19} weight="bold" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Creator Attribution Caption */}
          <p className="mt-1.5 text-center text-[11px] text-zinc-500/80">
            Onyx AI OS • Engineered by Abdullah Al Hadi
          </p>
        </div>
      </div>

      {/* Rich '+' Action Bottom Sheet */}
      <div
        aria-hidden={!isSheetOpen}
        className={`fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isSheetOpen
            ? 'visible pointer-events-auto opacity-100'
            : 'invisible pointer-events-none opacity-0'
        }`}
      >
        <div
          onClick={() => setIsSheetOpen(false)}
          className="absolute inset-0 bg-[#000000]/75 backdrop-blur-sm"
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-label="Composer tools and quick actions"
          className={`relative z-10 w-full max-w-[600px] rounded-t-3xl border border-white/[0.08] bg-[#181818] px-4 pt-3 pb-6 shadow-2xl transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:mb-3 sm:rounded-3xl ${
            isSheetOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}
        >
          {/* Drag handle */}
          <div
            aria-hidden="true"
            className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20"
          />

          {/* Top Horizontal Row of 4 Quick-Action Tiles */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#272727] px-2 py-3 text-white hover:bg-[#313131] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
              <Camera size={22} weight="regular" className="text-white/90" />
              <span className="text-xs font-medium text-white/85">Camera</span>
            </button>

            <button
              type="button"
              onClick={() => photosInputRef.current?.click()}
              className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#272727] px-2 py-3 text-white hover:bg-[#313131] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
              <Images size={22} weight="regular" className="text-white/90" />
              <span className="text-xs font-medium text-white/85">Photos</span>
            </button>

            <button
              type="button"
              onClick={() => filesInputRef.current?.click()}
              className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#272727] px-2 py-3 text-white hover:bg-[#313131] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
              <FileArrowUp size={22} weight="regular" className="text-white/90" />
              <span className="text-xs font-medium text-white/85">Files</span>
            </button>

            <button
              type="button"
              onClick={() => setShowVaultPicker((prev) => !prev)}
              aria-expanded={showVaultPicker}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                showVaultPicker
                  ? 'border-white/20 bg-[#313131]'
                  : 'border-white/[0.08] bg-[#272727] hover:bg-[#313131]'
              }`}
            >
              <Vault size={22} weight="regular" className="text-white/90" />
              <span className="text-xs font-medium text-white/85">Vault</span>
            </button>
          </div>

          {/* Expandable Quick Vault Picker */}
          {showVaultPicker && (
            <div className="mt-3 space-y-1.5 rounded-2xl border border-white/[0.08] bg-[#131209] p-2">
              <div className="px-2 py-1 font-mono text-xs text-white/50">
                Select memory vault context
              </div>
              {vaults.map((vault) => (
                <button
                  key={vault.id}
                  type="button"
                  onClick={() => {
                    onSelectVault(vault);
                    setIsSheetOpen(false);
                  }}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-white/85 hover:bg-[#272727] hover:text-white active:scale-[0.98]"
                >
                  <span className="truncate font-medium">{vault.name}</span>
                  <span className="shrink-0 font-mono text-white/45 tabular-nums">
                    {vault.itemCount} notes
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Mid-Chat Mode & Voice Language Switcher Row */}
          <div className="mt-3.5 flex items-center justify-between gap-2 rounded-2xl border border-white/[0.08] bg-[#1F1F1F] p-2">
            <div
              role="tablist"
              aria-label="Sheet interaction mode"
              className="relative grid flex-1 grid-cols-2 rounded-xl border border-white/[0.08] bg-[#16171E] p-1"
            >
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-[#2563EB] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  inputMode === 'task' ? 'translate-x-full' : 'translate-x-0'
                }`}
              />
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'chat'}
                onClick={() => onChangeInputMode('chat')}
                className={`relative z-10 flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium active:scale-[0.96] transition-transform duration-150 ${
                  inputMode === 'chat'
                    ? 'text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <ChatCircleText size={15} weight="regular" />
                <span>Chat</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'task'}
                onClick={() => onChangeInputMode('task')}
                className={`relative z-10 flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium active:scale-[0.96] transition-transform duration-150 ${
                  inputMode === 'task'
                    ? 'text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <ListChecks size={15} weight="regular" />
                <span>Task</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleToggleSpeechLang}
              aria-label={`Switch dictation language (current: ${
                speechLang === 'en-US' ? 'English' : 'Bangla'
              })`}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#272727] px-3.5 font-mono text-xs font-medium text-white hover:bg-[#313131] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 transition-transform duration-150"
            >
              <Translate size={15} weight="regular" className="text-blue-400" />
              <span>{speechLang === 'en-US' ? 'EN' : 'BN'}</span>
            </button>
          </div>

          {/* Vertical Interactive Tools List */}
          <div className="mt-3 space-y-1.5">
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={isDeepResearchOn}
              onClick={() => {
                onSelectRoutingMode(isDeepResearchOn ? 'auto' : 'deep-research');
                setIsSheetOpen(false);
              }}
              className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isDeepResearchOn
                  ? 'border border-white/[0.12] bg-[#272727] text-white'
                  : 'border border-white/[0.08] bg-[#1F1F1F] text-white/85 hover:bg-[#313131]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <GlobeHemisphereWest
                  size={19}
                  weight="regular"
                  className="shrink-0 text-white/80"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">
                    Deep Research
                  </span>
                  <span className="block text-xs text-white/50">
                    Live web verification &amp; rich visuals
                  </span>
                </span>
              </span>
              {isDeepResearchOn && (
                <Check size={16} weight="bold" className="shrink-0 text-[#60A5FA]" />
              )}
            </button>

            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={activeTools.createImage}
              onClick={() => {
                onToggleCreateImage();
                setIsSheetOpen(false);
              }}
              className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                activeTools.createImage
                  ? 'border border-white/[0.12] bg-[#272727] text-white'
                  : 'border border-white/[0.08] bg-[#1F1F1F] text-white/85 hover:bg-[#313131]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <ImageIcon
                  size={19}
                  weight="regular"
                  className="shrink-0 text-white/80"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">
                    Create Image
                  </span>
                  <span className="block text-xs text-white/50">
                    Generate visuals via Pollinations Flux
                  </span>
                </span>
              </span>
              {activeTools.createImage && (
                <Check size={16} weight="bold" className="shrink-0 text-[#60A5FA]" />
              )}
            </button>

            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={activeTools.generatePdf}
              onClick={() => {
                onToggleGeneratePdf();
                setIsSheetOpen(false);
              }}
              className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                activeTools.generatePdf
                  ? 'border border-white/[0.12] bg-[#272727] text-white'
                  : 'border border-white/[0.08] bg-[#1F1F1F] text-white/85 hover:bg-[#313131]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <FilePdf
                  size={19}
                  weight="regular"
                  className="shrink-0 text-white/80"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">
                    Generate PDF to Telegram
                  </span>
                  <span className="block text-xs text-white/50">
                    Compile and deliver brief to your vault
                  </span>
                </span>
              </span>
              {activeTools.generatePdf && (
                <Check size={16} weight="bold" className="shrink-0 text-[#60A5FA]" />
              )}
            </button>

            {/* Bottom Personal Intelligence switch toggle */}
            <div className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#131209] px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <Brain
                  size={19}
                  weight="regular"
                  className="shrink-0 text-white/80"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">
                    Personal Intelligence
                  </div>
                  <div className="text-xs text-white/50">
                    Include core profile memory in replies
                  </div>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isPersonalIntelligenceEnabled}
                aria-label="Toggle Personal Intelligence"
                onClick={onTogglePersonalIntelligence}
                className={`relative flex h-7 w-12 shrink-0 items-center rounded-full border border-white/[0.14] p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isPersonalIntelligenceEnabled ? 'bg-[#2563EB]' : 'bg-[#272727]'
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isPersonalIntelligenceEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
