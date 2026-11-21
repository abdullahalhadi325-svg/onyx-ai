import { useEffect, useState } from 'react';
import {
  Check,
  Eye,
  EyeSlash,
  LockKey,
  PaperPlaneTilt,
  ShieldCheck,
} from '@phosphor-icons/react';
import {
  hashAdminPin,
  isAdminEmail,
  saveLiveAdminConfig,
  sendSilentTelegramErrorAlert,
} from '../../lib/adminConfig';
import type { AdminConfig, ProviderToggles } from '../../types/onyx';

interface AdminPanelProps {
  userEmail: string | null;
  adminConfig: AdminConfig;
  onUpdateAdminConfig: (next: AdminConfig) => void;
}

const PROVIDER_LABELS: Array<{ key: keyof ProviderToggles; label: string }> = [
  { key: 'gemini', label: 'Gemini' },
  { key: 'groq', label: 'Groq' },
  { key: 'openrouter', label: 'OpenRouter' },
  { key: 'cloudflare', label: 'Cloudflare' },
];

export function AdminPanel({
  userEmail,
  adminConfig,
  onUpdateAdminConfig,
}: AdminPanelProps) {
  const autoUnlocked = isAdminEmail(userEmail);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(autoUnlocked);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);

  const [draft, setDraft] = useState<AdminConfig>(adminConfig);
  const [showBotToken, setShowBotToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [testAlertSent, setTestAlertSent] = useState(false);

  useEffect(() => {
    setDraft(adminConfig);
  }, [adminConfig]);

  useEffect(() => {
    if (autoUnlocked) {
      setIsUnlocked(true);
    }
  }, [autoUnlocked]);

  const hasExistingPin = Boolean(adminConfig.adminPinHash);

  async function handleUnlockOrSetupPin(event: React.FormEvent) {
    event.preventDefault();
    setPinFeedback(null);

    const cleanPin = pinInput.trim();
    if (cleanPin.length < 4) {
      setPinFeedback('Enter at least 4 characters for the Admin PIN.');
      return;
    }

    if (!hasExistingPin) {
      if (cleanPin !== pinConfirm.trim()) {
        setPinFeedback('PIN entries do not match.');
        return;
      }
      const hashed = await hashAdminPin(cleanPin);
      const nextConfig: AdminConfig = { ...draft, adminPinHash: hashed };
      onUpdateAdminConfig(nextConfig);
      await saveLiveAdminConfig(nextConfig);
      setIsUnlocked(true);
      setPinInput('');
      setPinConfirm('');
      return;
    }

    const enteredHash = await hashAdminPin(cleanPin);
    if (enteredHash === adminConfig.adminPinHash) {
      setIsUnlocked(true);
      setPinInput('');
    } else {
      setPinFeedback('Incorrect Admin PIN.');
    }
  }

  function handleToggleProvider(key: keyof ProviderToggles) {
    setDraft((prev) => ({
      ...prev,
      enabledProviders: {
        ...prev.enabledProviders,
        [key]: !prev.enabledProviders[key],
      },
    }));
  }

  async function handleSaveConfig() {
    setIsSaving(true);
    setSaveNotice(null);
    try {
      const result = await saveLiveAdminConfig(draft);
      onUpdateAdminConfig(draft);
      setSaveNotice(
        result.syncedToSupabase
          ? 'Synced live to Supabase onyx_admin_config.'
          : result.error || 'Saved locally on device.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleSendTestTelegramAlert() {
    sendSilentTelegramErrorAlert(
      {
        errorCode: 'TEST_PING',
        provider: 'admin-panel',
        detail: 'Silent developer telemetry verified from Onyx Admin Panel.',
      },
      draft
    );
    setTestAlertSent(true);
    window.setTimeout(() => setTestAlertSent(false), 2500);
  }

  if (!isUnlocked) {
    return (
      <form
        onSubmit={(e) => void handleUnlockOrSetupPin(e)}
        className="space-y-3 bg-[#0D0D10] px-4 py-3.5"
      >
        <div className="flex items-start gap-2.5">
          <LockKey size={16} weight="regular" className="mt-0.5 shrink-0 text-blue-400" />
          <div className="min-w-0">
            <div className="font-sans text-xs font-medium text-white">
              {hasExistingPin ? 'Admin PIN Required' : 'Initialize Admin PIN'}
            </div>
            <p className="mt-0.5 font-sans text-[11px] leading-relaxed text-zinc-400">
              {hasExistingPin
                ? 'Sign in with the admin account or enter your Admin PIN to edit live configuration.'
                : 'Set a private Admin PIN (stored only as a SHA-256 hash) to protect live controls.'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder={hasExistingPin ? 'Enter Admin PIN' : 'Create Admin PIN (min 4 chars)'}
            aria-label="Admin PIN"
            className="h-9 w-full rounded-xl bg-[#15151B] px-3 font-mono text-xs text-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          />
          {!hasExistingPin && (
            <input
              type="password"
              inputMode="numeric"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value)}
              placeholder="Confirm Admin PIN"
              aria-label="Confirm Admin PIN"
              className="h-9 w-full rounded-xl bg-[#15151B] px-3 font-mono text-xs text-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            />
          )}
        </div>

        {pinFeedback && (
          <p className="font-sans text-[11px] text-amber-300">{pinFeedback}</p>
        )}

        <button
          type="submit"
          className="flex h-9 w-full items-center justify-center rounded-xl bg-[#2563EB] font-sans text-xs font-medium text-white hover:bg-[#3B82F6] active:scale-[0.97] transition-transform duration-150"
        >
          {hasExistingPin ? 'Unlock Admin Panel' : 'Save Admin PIN & Unlock'}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3.5 bg-[#0D0D10] px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-300">
          <ShieldCheck size={14} weight="fill" />
          <span>{autoUnlocked ? 'Verified Admin Account' : 'Admin Unlocked'}</span>
        </span>
        <span className="font-mono text-[10px] text-zinc-500">
          onyx_admin_config
        </span>
      </div>

      {/* Global System Prompt */}
      <div>
        <label
          htmlFor="onyx-admin-system-prompt"
          className="mb-1 block font-sans text-xs font-medium text-zinc-300"
        >
          Global System Prompt
        </label>
        <textarea
          id="onyx-admin-system-prompt"
          rows={3}
          value={draft.globalSystemPrompt}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              globalSystemPrompt: e.target.value,
            }))
          }
          className="w-full resize-y rounded-xl bg-[#15151B] p-2.5 font-sans text-xs leading-relaxed text-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        />
      </div>

      {/* Enabled API Providers */}
      <div>
        <div className="mb-1.5 font-sans text-xs font-medium text-zinc-300">
          Enabled Cloud Providers
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {PROVIDER_LABELS.map(({ key, label }) => {
            const active = draft.enabledProviders[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => handleToggleProvider(key)}
                className={`flex h-9 items-center justify-between rounded-xl px-3 font-sans text-xs font-medium active:scale-[0.97] transition-colors duration-150 ${
                  active
                    ? 'bg-[#2563EB]/20 text-blue-200'
                    : 'bg-[#15151B] text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    active ? 'bg-blue-400' : 'bg-zinc-600'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily Limit & Global Announcement */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="onyx-admin-daily-limit"
            className="mb-1 block font-sans text-xs font-medium text-zinc-300"
          >
            Daily Message Limit
          </label>
          <input
            id="onyx-admin-daily-limit"
            type="number"
            min={5}
            max={10000}
            value={draft.dailyMessageLimit}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                dailyMessageLimit: Math.max(
                  5,
                  Math.min(10000, Number(e.target.value) || 60)
                ),
              }))
            }
            className="h-9 w-full rounded-xl bg-[#15151B] px-3 font-mono text-xs text-white tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          />
        </div>

        <div>
          <label
            htmlFor="onyx-admin-announcement"
            className="mb-1 block font-sans text-xs font-medium text-zinc-300"
          >
            Global Announcement
          </label>
          <input
            id="onyx-admin-announcement"
            type="text"
            value={draft.announcement}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                announcement: e.target.value,
              }))
            }
            placeholder="Optional notice banner"
            className="h-9 w-full rounded-xl bg-[#15151B] px-3 font-sans text-xs text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          />
        </div>
      </div>

      {/* Silent Telegram Error Reporting Config */}
      <div className="space-y-2 rounded-xl bg-[#131318] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-sans text-xs font-medium text-zinc-200">
            Silent Telegram Error Alerts
          </span>
          <button
            type="button"
            onClick={handleSendTestTelegramAlert}
            disabled={!draft.telegramBotToken || !draft.telegramChatId}
            className="inline-flex h-7 items-center gap-1 rounded-lg bg-white/[0.06] px-2 font-sans text-[11px] font-medium text-zinc-200 hover:bg-white/[0.12] disabled:opacity-40 active:scale-[0.96]"
          >
            {testAlertSent ? (
              <>
                <Check size={12} weight="bold" className="text-emerald-400" />
                <span>Sent</span>
              </>
            ) : (
              <>
                <PaperPlaneTilt size={12} weight="regular" />
                <span>Test</span>
              </>
            )}
          </button>
        </div>

        <div className="relative">
          <input
            type={showBotToken ? 'text' : 'password'}
            value={draft.telegramBotToken}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                telegramBotToken: e.target.value,
              }))
            }
            placeholder="Telegram Bot Token"
            aria-label="Telegram Bot Token"
            className="h-9 w-full rounded-xl bg-[#09090B] pr-9 pl-3 font-mono text-xs text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          />
          <button
            type="button"
            onClick={() => setShowBotToken((prev) => !prev)}
            aria-label={showBotToken ? 'Hide bot token' : 'Show bot token'}
            className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:text-white"
          >
            {showBotToken ? <EyeSlash size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <input
          type="text"
          value={draft.telegramChatId}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              telegramChatId: e.target.value,
            }))
          }
          placeholder="Developer Telegram Chat ID"
          aria-label="Developer Telegram Chat ID"
          className="h-9 w-full rounded-xl bg-[#09090B] px-3 font-mono text-xs text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        />
      </div>

      {saveNotice && (
        <p className="font-sans text-[11px] text-blue-300">{saveNotice}</p>
      )}

      <button
        type="button"
        disabled={isSaving}
        onClick={() => void handleSaveConfig()}
        className="flex h-10 w-full items-center justify-center rounded-xl bg-[#2563EB] font-sans text-xs font-medium text-white hover:bg-[#3B82F6] active:scale-[0.97] disabled:opacity-50 transition-transform duration-150"
      >
        {isSaving ? 'Syncing Config...' : 'Save Live Admin Config'}
      </button>
    </div>
  );
}
