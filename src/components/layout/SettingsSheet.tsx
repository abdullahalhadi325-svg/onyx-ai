import { ProCustomizationSection } from "./ProCustomizationSection";
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CaretRight,
  ChartBar,
  Check,
  Cloud,
  Cpu,
  Database,
  DownloadSimple,
  Globe,
  Info,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  TelegramLogo,
  Translate,
  Trash,
  UserFocus,
  WhatsappLogo,
  X,
} from '@phosphor-icons/react';
import { APP_VERSION, DEVELOPER_LINKS } from '../../lib/config';
import type { SpeechLanguageCode } from '../../lib/artifacts';
import {
  exportChatsAsJson,
  exportChatsAsMarkdown,
  formatResetCountdown,
  triggerTextFileDownload,
} from '../../lib/usage';
import type {
  AdminConfig,
  ChatSession,
  EngineMode,
  OnyxUserProfile,
  PersonaId,
  ResponseTone,
  UsageStats,
} from '../../types/onyx';
import {
  PERSONAS,
  RESPONSE_TONES,
  getPersonaOption,
} from '../../utils/onyxState';
import { AdminPanel } from '../settings/AdminPanel';

type ExpandedRow =
  | 'persona'
  | 'tone'
  | 'data'
  | 'admin'
  | 'about'
  | null;

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: OnyxUserProfile;
  engineMode: EngineMode;
  onChangeEngineMode: (mode: EngineMode) => void;
  onOpenLocalAIHub: () => void;
  persona: PersonaId;
  onSelectPersona: (persona: PersonaId) => void;
  responseTone: ResponseTone;
  onSelectResponseTone: (tone: ResponseTone) => void;
  speechLang: SpeechLanguageCode;
  onToggleSpeechLang: () => void;
  usageStats: UsageStats;
  adminConfig: AdminConfig;
  onUpdateAdminConfig: (next: AdminConfig) => void;
  chats: ChatSession[];
  onClearAllHistory: () => void;
  onSignOut: () => Promise<void>;
}

export function SettingsSheet({
  isOpen,
  onClose,
  userProfile,
  engineMode,
  onChangeEngineMode,
  onOpenLocalAIHub,
  persona,
  onSelectPersona,
  responseTone,
  onSelectResponseTone,
  speechLang,
  onToggleSpeechLang,
  usageStats,
  adminConfig,
  onUpdateAdminConfig,
  chats,
  onClearAllHistory,
  onSignOut,
}: SettingsSheetProps) {
  const [expandedRow, setExpandedRow] = useState<ExpandedRow>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const activePersonaOption = getPersonaOption(persona);
  const activeToneOption =
    RESPONSE_TONES.find((t) => t.id === responseTone) ?? RESPONSE_TONES[0];

  const dailyLimit = Math.max(1, adminConfig.dailyMessageLimit || 60);
  const usagePercent = Math.min(
    100,
    Math.round((usageStats.dailyMessages / dailyLimit) * 100)
  );
  const sessionTotalTokens =
    usageStats.sessionInputTokens + usageStats.sessionOutputTokens;
  const resetCountdown = formatResetCountdown();

  useEffect(() => {
    if (!isOpen) {
      setConfirmingSignOut(false);
      setConfirmingClear(false);
      setExpandedRow(null);
      setExportNotice(null);
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  function toggleRow(row: Exclude<ExpandedRow, null>) {
    setExpandedRow((prev) => (prev === row ? null : row));
    setConfirmingClear(false);
  }

  function handleExportJson() {
    const json = exportChatsAsJson(chats);
    triggerTextFileDownload(
      json,
      `onyx-chats-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
    setExportNotice('Exported JSON archive.');
    window.setTimeout(() => setExportNotice(null), 2400);
  }

  function handleExportMarkdown() {
    const md = exportChatsAsMarkdown(chats);
    triggerTextFileDownload(
      md,
      `onyx-chats-${new Date().toISOString().slice(0, 10)}.md`,
      'text/markdown'
    );
    setExportNotice('Exported Markdown transcript.');
    window.setTimeout(() => setExportNotice(null), 2400);
  }

  async function handleConfirmSignOut() {
    setIsSigningOut(true);
    try {
      await onSignOut();
      setConfirmingSignOut(false);
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] sm:items-center ${
        isOpen
          ? 'visible pointer-events-auto opacity-100'
          : 'invisible pointer-events-none opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm"
      />

      {/* Full Obsidian Settings Sheet */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Onyx settings"
        className={`relative z-10 flex max-h-[90dvh] w-full max-w-[490px] flex-col overflow-hidden rounded-t-3xl bg-[#09090B] shadow-2xl transition-[transform,opacity] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] sm:m-4 sm:rounded-3xl ${
          isOpen ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        {/* Drag handle */}
        <div
          aria-hidden="true"
          className="mx-auto mt-3 mb-2 h-1 w-9 shrink-0 rounded-full bg-white/15 sm:hidden"
        />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3 pb-3">
          <h2 className="font-serif text-xl font-medium tracking-tight text-white">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-white/[0.07] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 transition-transform duration-150"
          >
            <X size={18} weight="regular" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-7">
          {/* 1. Usage & Token Monitor */}
          <ProCustomizationSection />
          <div className="rounded-2xl onyx-bento-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-sans text-xs font-medium text-zinc-200">
                <ChartBar size={16} weight="regular" className="text-blue-400" />
                <span>Usage &amp; Token Monitor</span>
              </span>
              <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                Resets in {resetCountdown}
              </span>
            </div>

            {/* Daily Limit Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono text-xs tabular-nums">
                <span className="text-zinc-400">Daily Messages</span>
                <span className="text-white">
                  {usageStats.dailyMessages} / {dailyLimit}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#1C1C24]">
                <div
                  style={{ width: `${usagePercent}%` }}
                  className="h-full rounded-full bg-[var(--onyx-accent)] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                />
              </div>
            </div>

            {/* Token Metrics */}
            <div className="grid grid-cols-3 gap-2 pt-0.5">
              <div className="rounded-xl bg-[#0B0B0F] px-2.5 py-2">
                <div className="font-sans text-[10px] text-zinc-500 uppercase">
                  Session
                </div>
                <div className="mt-0.5 font-mono text-xs font-medium text-white tabular-nums">
                  {sessionTotalTokens.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl bg-[#0B0B0F] px-2.5 py-2">
                <div className="font-sans text-[10px] text-zinc-500 uppercase">
                  Total In
                </div>
                <div className="mt-0.5 font-mono text-xs font-medium text-zinc-200 tabular-nums">
                  {usageStats.totalInputTokens.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl bg-[#0B0B0F] px-2.5 py-2">
                <div className="font-sans text-[10px] text-zinc-500 uppercase">
                  Total Out
                </div>
                <div className="mt-0.5 font-mono text-xs font-medium text-zinc-200 tabular-nums">
                  {usageStats.totalOutputTokens.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Engine Selector (Cloud vs Local AI) */}
          <div className="rounded-2xl bg-[#111115] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans text-xs font-medium text-zinc-300">
                Active Engine
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLocalAIHub();
                }}
                className="font-sans text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                Open Local Hub
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#09090B] p-1">
              <button
                type="button"
                aria-pressed={engineMode === 'cloud'}
                onClick={() => onChangeEngineMode('cloud')}
                className={`flex h-9 items-center justify-center gap-1.5 rounded-lg font-sans text-xs font-medium active:scale-[0.97] transition-colors duration-150 ${
                  engineMode === 'cloud'
                    ? 'bg-[var(--onyx-accent)] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Cloud size={15} weight="regular" />
                <span>Cloud AI</span>
              </button>
              <button
                type="button"
                aria-pressed={engineMode === 'local'}
                onClick={() => onChangeEngineMode('local')}
                className={`flex h-9 items-center justify-center gap-1.5 rounded-lg font-sans text-xs font-medium active:scale-[0.97] transition-colors duration-150 ${
                  engineMode === 'local'
                    ? 'bg-[var(--onyx-accent)] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Cpu size={15} weight="regular" />
                <span>Local AI</span>
              </button>
            </div>
          </div>

          {/* 3. Preferences, Data Management, Admin Panel & About Onyx */}
          <div className="overflow-hidden rounded-2xl bg-[#111115] divide-y divide-white/[0.05]">
            {/* Response Tone */}
            <div>
              <button
                type="button"
                onClick={() => toggleRow('tone')}
                aria-expanded={expandedRow === 'tone'}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] active:scale-[0.99] transition-colors duration-150"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <SlidersHorizontal
                    size={18}
                    weight="regular"
                    className="shrink-0 text-zinc-400"
                  />
                  <span className="truncate font-sans text-sm font-medium text-white">
                    Response Tone
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="font-sans text-xs text-zinc-400">
                    {activeToneOption.label}
                  </span>
                  <CaretRight
                    size={14}
                    weight="bold"
                    className={`text-zinc-500 transition-transform duration-200 ${
                      expandedRow === 'tone' ? 'rotate-90' : 'rotate-0'
                    }`}
                  />
                </span>
              </button>

              {expandedRow === 'tone' && (
                <div className="bg-[#0D0D10] px-3 py-2 space-y-1">
                  {RESPONSE_TONES.map((option) => {
                    const isSelected = option.id === responseTone;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => onSelectResponseTone(option.id)}
                        aria-pressed={isSelected}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left active:scale-[0.98] transition-colors duration-150 ${
                          isSelected
                            ? 'bg-[var(--onyx-accent)]/20 text-white'
                            : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-sans text-sm font-medium">
                            {option.label}
                          </div>
                          <div className="font-sans text-[11px] text-zinc-500">
                            {option.hint}
                          </div>
                        </div>
                        {isSelected && (
                          <Check size={15} weight="bold" className="shrink-0 text-blue-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Persona */}
            <div>
              <button
                type="button"
                onClick={() => toggleRow('persona')}
                aria-expanded={expandedRow === 'persona'}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] active:scale-[0.99] transition-colors duration-150"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <UserFocus
                    size={18}
                    weight="regular"
                    className="shrink-0 text-zinc-400"
                  />
                  <span className="truncate font-sans text-sm font-medium text-white">
                    Active Persona
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="font-sans text-xs text-zinc-400">
                    {activePersonaOption.name}
                  </span>
                  <CaretRight
                    size={14}
                    weight="bold"
                    className={`text-zinc-500 transition-transform duration-200 ${
                      expandedRow === 'persona' ? 'rotate-90' : 'rotate-0'
                    }`}
                  />
                </span>
              </button>

              {expandedRow === 'persona' && (
                <div className="bg-[#0D0D10] px-3 py-2 space-y-1">
                  {PERSONAS.map((option) => {
                    const isSelected = option.id === persona;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => onSelectPersona(option.id)}
                        aria-pressed={isSelected}
                        className={`flex min-h-[40px] w-full items-center justify-between rounded-xl px-3 py-2 text-left font-sans text-sm active:scale-[0.98] transition-colors duration-150 ${
                          isSelected
                            ? 'bg-[var(--onyx-accent)]/20 text-white font-medium'
                            : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                        }`}
                      >
                        <span>{option.name}</span>
                        {isSelected && (
                          <Check size={15} weight="bold" className="shrink-0 text-blue-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Language */}
            <button
              type="button"
              onClick={onToggleSpeechLang}
              aria-label={`Switch language (current: ${
                speechLang === 'en-US' ? 'English' : 'Bangla'
              })`}
              className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] active:scale-[0.99] transition-colors duration-150"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Translate
                  size={18}
                  weight="regular"
                  className="shrink-0 text-zinc-400"
                />
                <span className="truncate font-sans text-sm font-medium text-white">
                  Language
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 font-sans text-xs font-medium text-blue-300">
                {speechLang === 'en-US' ? 'English (EN)' : 'Bangla (BN)'}
              </span>
            </button>

            {/* Data Management */}
            <div>
              <button
                type="button"
                onClick={() => toggleRow('data')}
                aria-expanded={expandedRow === 'data'}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] active:scale-[0.99] transition-colors duration-150"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Database
                    size={18}
                    weight="regular"
                    className="shrink-0 text-zinc-400"
                  />
                  <span className="truncate font-sans text-sm font-medium text-white">
                    Data Management
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="font-mono text-xs text-zinc-500 tabular-nums">
                    {chats.length} chats
                  </span>
                  <CaretRight
                    size={14}
                    weight="bold"
                    className={`text-zinc-500 transition-transform duration-200 ${
                      expandedRow === 'data' ? 'rotate-90' : 'rotate-0'
                    }`}
                  />
                </span>
              </button>

              {expandedRow === 'data' && (
                <div className="bg-[#0D0D10] px-4 py-3.5 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-3 font-sans text-xs font-medium text-white hover:bg-white/[0.11] active:scale-[0.97]"
                    >
                      <DownloadSimple size={14} weight="bold" className="text-blue-400" />
                      <span>Export JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportMarkdown}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-3 font-sans text-xs font-medium text-white hover:bg-white/[0.11] active:scale-[0.97]"
                    >
                      <DownloadSimple size={14} weight="bold" className="text-blue-400" />
                      <span>Export MD</span>
                    </button>
                  </div>

                  {exportNotice && (
                    <p className="font-sans text-[11px] text-emerald-300">
                      {exportNotice}
                    </p>
                  )}

                  {confirmingClear ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-red-500/10 px-3 py-2">
                      <span className="font-sans text-xs text-red-200">
                        Delete all local chats?
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmingClear(false)}
                          className="h-7 rounded-lg px-2.5 font-sans text-xs text-zinc-300 hover:bg-white/[0.08]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClearAllHistory();
                            setConfirmingClear(false);
                          }}
                          className="h-7 rounded-lg bg-red-500/25 px-2.5 font-sans text-xs font-medium text-red-100 hover:bg-red-500/35"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingClear(true)}
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-red-500/10 font-sans text-xs font-medium text-red-300 hover:bg-red-500/20 active:scale-[0.97]"
                    >
                      <Trash size={14} weight="regular" />
                      <span>Clear All History</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Protected Admin Panel */}
            <div>
              <button
                type="button"
                onClick={() => toggleRow('admin')}
                aria-expanded={expandedRow === 'admin'}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] active:scale-[0.99] transition-colors duration-150"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <ShieldCheck
                    size={18}
                    weight="regular"
                    className="shrink-0 text-blue-400"
                  />
                  <span className="truncate font-sans text-sm font-medium text-white">
                    Admin Panel
                  </span>
                </span>
                <CaretRight
                  size={14}
                  weight="bold"
                  className={`shrink-0 text-zinc-500 transition-transform duration-200 ${
                    expandedRow === 'admin' ? 'rotate-90' : 'rotate-0'
                  }`}
                />
              </button>

              {expandedRow === 'admin' && (
                <AdminPanel
                  userEmail={userProfile.email}
                  adminConfig={adminConfig}
                  onUpdateAdminConfig={onUpdateAdminConfig}
                />
              )}
            </div>

            {/* About Onyx (Abdullah Al Hadi) — Portfolio + Telegram @abdullahalhadis + WhatsApp +8801723257754 */}
            <div>
              <button
                type="button"
                onClick={() => toggleRow('about')}
                aria-expanded={expandedRow === 'about'}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] active:scale-[0.99] transition-colors duration-150"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Info
                    size={18}
                    weight="regular"
                    className="shrink-0 text-zinc-400"
                  />
                  <span className="truncate font-sans text-sm font-medium text-white">
                    About Onyx (Abdullah Al Hadi)
                  </span>
                </span>
                <CaretRight
                  size={14}
                  weight="bold"
                  className={`shrink-0 text-zinc-500 transition-transform duration-200 ${
                    expandedRow === 'about' ? 'rotate-90' : 'rotate-0'
                  }`}
                />
              </button>

              {expandedRow === 'about' && (
                <div className="bg-[#0D0D10] px-4 py-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-sans text-xs leading-relaxed text-zinc-300">
                      Architected &amp; engineered by Abdullah Al Hadi.
                    </p>
                    <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                      v{APP_VERSION}
                    </span>
                  </div>

                  {/* Clean Responsive Obsidian Dark Developer Contact Buttons (wraps cleanly on 390px) */}
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={DEVELOPER_LINKS.portfolio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[40px] flex-1 basis-[120px] items-center justify-center gap-1.5 rounded-xl bg-[#161923] px-3 py-2 font-sans text-xs font-medium text-white hover:bg-[#1E2333] active:scale-[0.97] transition-transform duration-150"
                    >
                      <Globe size={15} weight="regular" className="shrink-0 text-blue-400" />
                      <span>Portfolio</span>
                      <ArrowUpRight size={12} weight="bold" className="shrink-0 text-blue-300" />
                    </a>

                    <a
                      href={DEVELOPER_LINKS.telegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Telegram ${DEVELOPER_LINKS.telegramHandle}`}
                      className="flex min-h-[40px] flex-1 basis-[140px] items-center justify-center gap-1.5 rounded-xl bg-[#131C2B] px-3 py-2 font-sans text-xs font-medium text-blue-100 hover:bg-[#1A283D] active:scale-[0.97] transition-transform duration-150"
                    >
                      <TelegramLogo size={16} weight="fill" className="shrink-0 text-sky-400" />
                      <span className="truncate">{DEVELOPER_LINKS.telegramHandle}</span>
                      <ArrowUpRight size={12} weight="bold" className="shrink-0 text-sky-300" />
                    </a>

                    <a
                      href={DEVELOPER_LINKS.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`WhatsApp ${DEVELOPER_LINKS.whatsappNumber}`}
                      className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-[#11221B] px-3 py-2 font-sans text-xs font-medium text-emerald-100 hover:bg-[#162E24] active:scale-[0.97] transition-transform duration-150"
                    >
                      <WhatsappLogo size={17} weight="fill" className="shrink-0 text-emerald-400" />
                      <span>WhatsApp · {DEVELOPER_LINKS.whatsappNumber}</span>
                      <ArrowUpRight size={12} weight="bold" className="shrink-0 text-emerald-300" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Sign Out */}
            {confirmingSignOut ? (
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <span className="truncate font-sans text-xs text-zinc-300">
                  {userProfile.isGuest ? 'Leave Guest session?' : 'Sign out now?'}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isSigningOut}
                    onClick={() => setConfirmingSignOut(false)}
                    className="h-8 rounded-lg px-3 font-sans text-xs font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-white active:scale-[0.96]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSigningOut}
                    onClick={() => void handleConfirmSignOut()}
                    className="h-8 rounded-lg bg-red-500/20 px-3 font-sans text-xs font-medium text-red-200 hover:bg-red-500/30 active:scale-[0.96] disabled:opacity-50"
                  >
                    {isSigningOut ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingSignOut(true)}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] active:scale-[0.99] transition-colors duration-150"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <SignOut
                    size={18}
                    weight="regular"
                    className="shrink-0 text-red-400"
                  />
                  <span className="truncate font-sans text-sm font-medium text-red-400">
                    Sign Out
                  </span>
                </span>
                <span className="shrink-0 font-sans text-xs text-zinc-500">
                  {userProfile.isGuest ? 'Guest' : userProfile.displayName}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
