import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Camera,
  ChatCircleText,
  Check,
  FileArrowUp,
  GlobeHemisphereWest,
  Image as ImageIcon,
  Images,
  ListChecks,
  Microphone,
  Paperclip,
  Plus,
  Stop,
  Translate,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import type { SpeechLanguageCode } from '../../lib/artifacts';
import type {
  ActiveTools,
  ImageAttachmentPayload,
  InputMode,
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
  onToggleCreateImage: () => void;
  onAttachFile: (fileName: string | null) => void;
  onAttachImage: (image: ImageAttachmentPayload | null) => void;
  onSubmit: () => void;
  isSending?: boolean;
  canStopGeneration?: boolean;
  onStopGeneration?: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

const WAVEFORM_HEIGHTS = [14, 22, 18, 26, 16, 24, 14];

function readFileAsBase64Payload(file: File): Promise<ImageAttachmentPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = dataUrl.indexOf(',');
      if (commaIndex === -1) {
        reject(new Error('Invalid image encoding'));
        return;
      }
      const header = dataUrl.slice(0, commaIndex);
      const base64Data = dataUrl.slice(commaIndex + 1);
      const mimeMatch = /^data:([^;]+);base64$/i.exec(header);
      const mimeType = file.type || mimeMatch?.[1] || 'image/jpeg';

      resolve({
        fileName: file.name,
        mimeType,
        base64Data,
        previewUrl: dataUrl,
      });
    };
    reader.onerror = () => reject(new Error('Could not read selected image'));
    reader.readAsDataURL(file);
  });
}

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
  onToggleCreateImage,
  onAttachFile,
  onAttachImage,
  onSubmit,
  isSending = false,
  canStopGeneration = false,
  onStopGeneration,
  textareaRef,
}: InputDockProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseValueRef = useRef<string>('');
  const latestValueRef = useRef<string>(value);

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

  // Clean up SpeechRecognition on unmount
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
    };
  }, []);

  // Close sheet on Escape
  useEffect(() => {
    if (!isSheetOpen) {
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

  const hasAttachedImage = Boolean(activeTools.attachedImage?.previewUrl);
  const canSend =
    !isSending &&
    (value.trim().length > 0 ||
      activeTools.attachedFileName !== null ||
      hasAttachedImage ||
      activeTools.createImage);

  const isDeepResearchOn = routingMode === 'deep-research';
  const hasActiveTools =
    activeTools.createImage ||
    Boolean(activeTools.attachedFileName) ||
    hasAttachedImage;

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

  async function handleMediaSelected(
    event: React.ChangeEvent<HTMLInputElement>,
    isImagePicker: boolean
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setIsSheetOpen(false);

    if (!file) {
      return;
    }

    const isImg = isImagePicker || file.type.startsWith('image/');
    if (isImg) {
      try {
        const imagePayload = await readFileAsBase64Payload(file);
        onAttachImage(imagePayload);
      } catch {
        onAttachFile(file.name);
      }
    } else {
      onAttachImage(null);
      onAttachFile(file.name);
    }
  }

  function handleClearAttachment() {
    onAttachImage(null);
    onAttachFile(null);
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
          {/* Voice notice */}
          {voiceError && (
            <div
              role="status"
              className="flex items-center justify-between gap-2 rounded-2xl bg-[#13131A] px-3.5 py-2 text-xs text-zinc-200"
            >
              <span className="flex min-w-0 items-center gap-2">
                <WarningCircle
                  size={15}
                  weight="regular"
                  className="shrink-0 text-blue-300"
                />
                <span className="truncate">{voiceError}</span>
              </span>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                aria-label="Dismiss voice notice"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[0.08] hover:text-white active:scale-[0.96]"
              >
                <X size={13} weight="bold" />
              </button>
            </div>
          )}

          {/* Multimodal Image Preview Strip (Vision -> Gemini) */}
          {activeTools.attachedImage && (
            <div className="flex items-center gap-3 rounded-2xl bg-[#12141E] p-2.5">
              <img
                src={activeTools.attachedImage.previewUrl}
                alt={activeTools.attachedImage.fileName}
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-sans text-xs font-medium text-white">
                  {activeTools.attachedImage.fileName}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-blue-300/80">
                  Vision · Gemini Ready
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearAttachment}
                aria-label={`Remove ${activeTools.attachedImage.fileName}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] hover:text-white active:scale-[0.96]"
              >
                <X size={15} weight="bold" />
              </button>
            </div>
          )}

          {/* Active Tool Chips */}
          {hasActiveTools && !activeTools.attachedImage && (
            <div className="flex flex-wrap items-center gap-1.5 px-1">
              {activeTools.createImage && (
                <button
                  type="button"
                  onClick={onToggleCreateImage}
                  aria-label="Remove Create Image"
                  className="flex h-8 items-center gap-1.5 rounded-full bg-[#121828] px-3 font-mono text-xs text-blue-200 hover:bg-[#192238] active:scale-[0.96] transition-transform duration-150"
                >
                  <ImageIcon size={14} weight="regular" />
                  <span>Image · Flux</span>
                  <X size={12} weight="bold" className="text-blue-300/70" />
                </button>
              )}

              {activeTools.attachedFileName && (
                <button
                  type="button"
                  onClick={handleClearAttachment}
                  aria-label={`Detach ${activeTools.attachedFileName}`}
                  className="flex h-8 max-w-full items-center gap-1.5 rounded-full bg-[#16171F] px-3 font-mono text-xs text-zinc-200 hover:bg-[#1F212B] active:scale-[0.96] transition-transform duration-150"
                >
                  <Paperclip size={14} weight="regular" className="shrink-0 text-zinc-400" />
                  <span className="max-w-[220px] truncate">
                    {activeTools.attachedFileName}
                  </span>
                  <X size={12} weight="bold" className="shrink-0 text-zinc-400" />
                </button>
              )}
            </div>
          )}

          {/* Seamless Obsidian Floating Composer Pill */}
          <div
            className={`relative bg-[#11131B]/95 p-1.5 shadow-[0_0_32px_rgba(37,99,235,0.20)] transition-[box-shadow,background-color] duration-200 focus-within:bg-[#141722] focus-within:shadow-[0_0_38px_rgba(59,130,246,0.32)] ${
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
              onChange={(event) => void handleMediaSelected(event, true)}
              aria-hidden="true"
              tabIndex={-1}
            />
            <input
              ref={photosInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleMediaSelected(event, true)}
              aria-hidden="true"
              tabIndex={-1}
            />
            <input
              ref={filesInputRef}
              type="file"
              className="hidden"
              onChange={(event) => void handleMediaSelected(event, false)}
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
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[#222533] text-white hover:bg-[#2C3042] active:scale-[0.96] transition-transform duration-150"
                  >
                    <Stop size={17} weight="fill" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDispatch}
                    disabled={!canSend}
                    aria-label="Send voice message"
                    className="flex h-11 w-11 items-center justify-center rounded-full onyx-accent-btn text-white shadow-lg shadow-blue-600/25  active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45 transition-transform duration-150"
                  >
                    <ArrowUp size={19} weight="bold" />
                  </button>
                </div>
              </div>
            ) : (
              /* Standard Text Input Pill */
              <div className="flex items-end gap-1.5">
                {/* Left '+' Button opening Clean Action Sheet */}
                <button
                  type="button"
                  onClick={() => setIsSheetOpen(true)}
                  aria-label="Open tool actions"
                  aria-expanded={isSheetOpen}
                  aria-haspopup="dialog"
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 transition-transform duration-150 ${
                    isSheetOpen || hasActiveTools
                      ? 'bg-[#21273A] text-white hover:bg-[#2A324A]'
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
                      hasAttachedImage
                        ? 'Ask about this image...'
                        : activeTools.createImage
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

                  {canStopGeneration && onStopGeneration ? (
                    <button
                      type="button"
                      onClick={onStopGeneration}
                      aria-label="Stop generation"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-[#222533] text-white hover:bg-[#2C3042] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 transition-transform duration-150"
                    >
                      <Stop size={17} weight="fill" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDispatch}
                      disabled={!canSend}
                      aria-label="Send message"
                      className={`flex h-11 w-11 items-center justify-center rounded-full active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 transition-transform duration-150 ${
                        canSend
                          ? 'onyx-accent-btn text-white shadow-lg shadow-blue-600/30 '
                          : 'cursor-not-allowed bg-[#1B1E28] text-zinc-500'
                      }`}
                    >
                      <ArrowUp size={19} weight="bold" />
                    </button>
                  )}
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

      {/* Clean Public-Ready '+' Action Bottom Sheet (Zero Developer-Only Vault/Telegram Tools) */}
      <div
        aria-hidden={!isSheetOpen}
        className={`fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isSheetOpen
            ? 'visible pointer-events-auto opacity-100'
            : 'invisible pointer-events-none opacity-0'
        }`}
      >
        <div
          onClick={() => setIsSheetOpen(false)}
          className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm"
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-label="Composer tools and quick actions"
          className={`relative z-10 w-full max-w-[560px] rounded-t-3xl bg-[#0D0D11] px-4 pt-3 pb-6 shadow-2xl transition-[transform,opacity] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] sm:mb-3 sm:rounded-3xl ${
            isSheetOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}
        >
          {/* Drag handle */}
          <div
            aria-hidden="true"
            className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15"
          />

          {/* Top Horizontal Row of 3 Clean User Tiles: Camera, Photos, Files */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl bg-[#16171E] px-2 py-3 text-white hover:bg-[#1E202B] active:scale-[0.96] transition-transform duration-150"
            >
              <Camera size={22} weight="regular" className="text-blue-300" />
              <span className="text-xs font-medium text-zinc-200">Camera</span>
            </button>

            <button
              type="button"
              onClick={() => photosInputRef.current?.click()}
              className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl bg-[#16171E] px-2 py-3 text-white hover:bg-[#1E202B] active:scale-[0.96] transition-transform duration-150"
            >
              <Images size={22} weight="regular" className="text-blue-300" />
              <span className="text-xs font-medium text-zinc-200">Photos</span>
            </button>

            <button
              type="button"
              onClick={() => filesInputRef.current?.click()}
              className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl bg-[#16171E] px-2 py-3 text-white hover:bg-[#1E202B] active:scale-[0.96] transition-transform duration-150"
            >
              <FileArrowUp size={22} weight="regular" className="text-blue-300" />
              <span className="text-xs font-medium text-zinc-200">Files</span>
            </button>
          </div>

          {/* Mid-Chat Mode & Language Switcher Row */}
          <div className="mt-3.5 flex items-center justify-between gap-2 rounded-2xl bg-[#14151C] p-2">
            <div
              role="tablist"
              aria-label="Sheet interaction mode"
              className="relative grid flex-1 grid-cols-2 rounded-xl bg-[#0B0C10] p-1"
            >
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg onyx-accent-btn transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#1C1E28] px-3.5 font-mono text-xs font-medium text-white hover:bg-[#252836] active:scale-[0.96] transition-transform duration-150"
            >
              <Translate size={15} weight="regular" className="text-blue-400" />
              <span>{speechLang === 'en-US' ? 'EN' : 'BN'}</span>
            </button>
          </div>

          {/* Vertical Clean User Tools List */}
          <div className="mt-3 space-y-2">
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={isDeepResearchOn}
              onClick={() => {
                onSelectRoutingMode(isDeepResearchOn ? 'auto' : 'deep-research');
                setIsSheetOpen(false);
              }}
              className={`flex min-h-[50px] w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left active:scale-[0.97] transition-colors duration-150 ${
                isDeepResearchOn
                  ? 'bg-[#1A243B] text-white'
                  : 'bg-[#14151C] text-zinc-200 hover:bg-[#1C1E28]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <GlobeHemisphereWest
                  size={19}
                  weight="regular"
                  className="shrink-0 text-blue-300"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">
                    Deep Research
                  </span>
                  <span className="block text-xs text-zinc-400">
                    Live web verification &amp; rich visuals
                  </span>
                </span>
              </span>
              {isDeepResearchOn && (
                <Check size={16} weight="bold" className="shrink-0 text-blue-400" />
              )}
            </button>

            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={activeTools.createImage}
              disabled={hasAttachedImage}
              onClick={() => {
                onToggleCreateImage();
                setIsSheetOpen(false);
              }}
              className={`flex min-h-[50px] w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 transition-colors duration-150 ${
                activeTools.createImage
                  ? 'bg-[#1A243B] text-white'
                  : 'bg-[#14151C] text-zinc-200 hover:bg-[#1C1E28]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <ImageIcon
                  size={19}
                  weight="regular"
                  className="shrink-0 text-blue-300"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">
                    Create Image
                  </span>
                  <span className="block text-xs text-zinc-400">
                    {hasAttachedImage
                      ? 'Disabled while analyzing attached image'
                      : 'Generate visuals via Pollinations Flux'}
                  </span>
                </span>
              </span>
              {activeTools.createImage && (
                <Check size={16} weight="bold" className="shrink-0 text-blue-400" />
              )}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
