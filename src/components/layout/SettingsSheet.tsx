import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CaretRight,
  Check,
  Info,
  SignOut,
  Translate,
  UserFocus,
  X,
} from '@phosphor-icons/react';
import type { SpeechLanguageCode } from '../../lib/artifacts';
import type { OnyxUserProfile, PersonaId } from '../../types/onyx';
import { getPersonaOption, PERSONAS } from '../../utils/onyxState';

type ExpandedRow = 'persona' | 'about' | null;

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: OnyxUserProfile;
  persona: PersonaId;
  onSelectPersona: (persona: PersonaId) => void;
  speechLang: SpeechLanguageCode;
  onToggleSpeechLang: () => void;
  onSignOut: () => Promise<void>;
}

export function SettingsSheet({
  isOpen,
  onClose,
  userProfile,
  persona,
  onSelectPersona,
  speechLang,
  onToggleSpeechLang,
  onSignOut,
}: SettingsSheetProps) {
  const [expandedRow, setExpandedRow] = useState<ExpandedRow>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const activePersonaOption = getPersonaOption(persona);

  useEffect(() => {
    if (!isOpen) {
      setConfirmingSignOut(false);
      setExpandedRow(null);
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
      className={`fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] sm:items-center ${
        isOpen
          ? 'visible pointer-events-auto opacity-100'
          : 'invisible pointer-events-none opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#000000]/75 backdrop-blur-sm"
      />

      {/* Clean iOS-style Dark Settings Sheet */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Onyx settings"
        className={`relative z-10 w-full max-w-[460px] rounded-t-3xl border border-white/[0.08] bg-[#0B0B0E] px-5 pt-3 pb-7 shadow-2xl transition-[transform,opacity] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] sm:m-4 sm:rounded-3xl ${
          isOpen ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        {/* Drag handle */}
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/15 sm:hidden"
        />

        {/* Minimal Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
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

        {/* Clean iOS-Style Grouped Dark List */}
        <div className="overflow-hidden rounded-2xl bg-[#111114] divide-y divide-white/[0.06]">
          {/* 1. Active Persona */}
          <div>
            <button
              type="button"
              onClick={() => toggleRow('persona')}
              aria-expanded={expandedRow === 'persona'}
              className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400/40 transition-colors duration-150"
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
                  className={`text-zinc-500 transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
                      className={`flex min-h-[42px] w-full items-center justify-between rounded-xl px-3 py-2 text-left font-sans text-sm active:scale-[0.98] transition-colors duration-150 ${
                        isSelected
                          ? 'bg-[#2563EB]/18 text-white font-medium'
                          : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      <span>{option.name}</span>
                      {isSelected && (
                        <Check
                          size={15}
                          weight="bold"
                          className="shrink-0 text-blue-400"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Language */}
          <button
            type="button"
            onClick={onToggleSpeechLang}
            aria-label={`Switch language (current: ${
              speechLang === 'en-US' ? 'English' : 'Bangla'
            })`}
            className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400/40 transition-colors duration-150"
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

          {/* 3. About Onyx (Abdullah Al Hadi) */}
          <div>
            <button
              type="button"
              onClick={() => toggleRow('about')}
              aria-expanded={expandedRow === 'about'}
              className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400/40 transition-colors duration-150"
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
                className={`shrink-0 text-zinc-500 transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  expandedRow === 'about' ? 'rotate-90' : 'rotate-0'
                }`}
              />
            </button>

            {expandedRow === 'about' && (
              <div className="bg-[#0D0D10] px-4 py-3.5 space-y-3">
                <p className="font-sans text-xs leading-relaxed text-zinc-400">
                  Architected by Abdullah Al Hadi (Abdullah Al Hadi | Dev).
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href="https://mr-onion-dev-portfolio-ud2z.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-3 font-sans text-xs font-medium text-white hover:bg-white/[0.11] active:scale-[0.97] transition-transform duration-150"
                  >
                    <span>Portfolio</span>
                    <ArrowUpRight size={13} weight="bold" className="text-blue-400" />
                  </a>
                  <a
                    href="https://t.me/developerhadi0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-3 font-sans text-xs font-medium text-white hover:bg-white/[0.11] active:scale-[0.97] transition-transform duration-150"
                  >
                    <span>Telegram</span>
                    <ArrowUpRight size={13} weight="bold" className="text-blue-400" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* 4. Sign Out */}
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
                  onClick={handleConfirmSignOut}
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
              className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400/40 transition-colors duration-150"
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
      </section>
    </div>
  );
}
