import {
  ADMIN_EMAIL,
  APP_VERSION,
  ENV_ADMIN_PIN_HASH,
  ENV_TELEGRAM_BOT_TOKEN,
  ENV_TELEGRAM_CHAT_ID,
} from './config';
import { supabase } from './supabase';
import { loadCachedAdminConfig, saveCachedAdminConfig } from './storage';
import type { AdminConfig } from '../types/onyx';

export const DEFAULT_GLOBAL_SYSTEM_PROMPT =
  'You are Onyx AI OS. Give crisp, direct, accurate answers with zero filler, zero unnecessary disclaimers, and clean Markdown formatting. Match the user language automatically (English or Bengali).';

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  globalSystemPrompt: DEFAULT_GLOBAL_SYSTEM_PROMPT,
  enabledProviders: {
    gemini: true,
    groq: true,
    openrouter: true,
    cloudflare: true,
  },
  dailyMessageLimit: 60,
  announcement: '',
  telegramBotToken: ENV_TELEGRAM_BOT_TOKEN,
  telegramChatId: ENV_TELEGRAM_CHAT_ID,
  adminPinHash: ENV_ADMIN_PIN_HASH || undefined,
};

export function mergeAdminConfig(raw?: Partial<AdminConfig> | null): AdminConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_ADMIN_CONFIG,
      enabledProviders: { ...DEFAULT_ADMIN_CONFIG.enabledProviders },
    };
  }

  return {
    globalSystemPrompt:
      typeof raw.globalSystemPrompt === 'string' && raw.globalSystemPrompt.trim()
        ? raw.globalSystemPrompt.trim()
        : DEFAULT_GLOBAL_SYSTEM_PROMPT,
    enabledProviders: {
      gemini: raw.enabledProviders?.gemini ?? true,
      groq: raw.enabledProviders?.groq ?? true,
      openrouter: raw.enabledProviders?.openrouter ?? true,
      cloudflare: raw.enabledProviders?.cloudflare ?? true,
    },
    dailyMessageLimit:
      typeof raw.dailyMessageLimit === 'number' &&
      Number.isFinite(raw.dailyMessageLimit) &&
      raw.dailyMessageLimit >= 5
        ? Math.min(Math.round(raw.dailyMessageLimit), 10000)
        : DEFAULT_ADMIN_CONFIG.dailyMessageLimit,
    announcement:
      typeof raw.announcement === 'string' ? raw.announcement.trim() : '',
    telegramBotToken:
      typeof raw.telegramBotToken === 'string' && raw.telegramBotToken.trim()
        ? raw.telegramBotToken.trim()
        : ENV_TELEGRAM_BOT_TOKEN,
    telegramChatId:
      typeof raw.telegramChatId === 'string' && raw.telegramChatId.trim()
        ? raw.telegramChatId.trim()
        : ENV_TELEGRAM_CHAT_ID,
    adminPinHash:
      typeof raw.adminPinHash === 'string' && raw.adminPinHash.trim()
        ? raw.adminPinHash.trim()
        : ENV_ADMIN_PIN_HASH || undefined,
  };
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) {
    return false;
  }
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export async function hashAdminPin(pin: string): Promise<string> {
  const normalized = pin.trim();
  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof TextEncoder !== 'undefined'
  ) {
    const data = new TextEncoder().encode(`onyx-admin-pin-v1:${normalized}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic hash for non-WebCrypto test runtimes
  let acc = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    acc ^= normalized.charCodeAt(i);
    acc = Math.imul(acc, 16777619);
  }
  return `fnv1a_${(acc >>> 0).toString(16)}`;
}

export async function fetchLiveAdminConfig(): Promise<AdminConfig> {
  const cached = await loadCachedAdminConfig();
  try {
    const { data, error } = await supabase
      .from('onyx_admin_config')
      .select('config')
      .eq('id', 1)
      .maybeSingle();

    if (!error && data && typeof data === 'object') {
      const row = data as { config?: Partial<AdminConfig> | null };
      const merged = mergeAdminConfig(row.config);
      await saveCachedAdminConfig(merged);
      return merged;
    }
  } catch {
    // Gracefully fall back to cached / default config
  }

  return mergeAdminConfig(cached);
}

export async function saveLiveAdminConfig(
  nextConfig: AdminConfig
): Promise<{ syncedToSupabase: boolean; error: string | null }> {
  const sanitized = mergeAdminConfig(nextConfig);
  await saveCachedAdminConfig(sanitized);

  try {
    const { error } = await supabase.from('onyx_admin_config').upsert(
      {
        id: 1,
        config: sanitized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      return {
        syncedToSupabase: false,
        error: `Saved locally. Supabase sync note: ${error.message}`,
      };
    }

    return { syncedToSupabase: true, error: null };
  } catch (err) {
    return {
      syncedToSupabase: false,
      error:
        err instanceof Error
          ? `Saved locally. Supabase unavailable: ${err.message}`
          : 'Saved locally.',
    };
  }
}

export interface SilentTelemetryPayload {
  errorCode: string;
  provider: string;
  detail?: string;
  mode?: string;
}

/**
 * Silent fire-and-forget developer telemetry alert to Telegram Bot API.
 * Strictly invisible to regular users; never throws or blocks chat UX.
 */
export function sendSilentTelegramErrorAlert(
  payload: SilentTelemetryPayload,
  adminConfig?: Pick<AdminConfig, 'telegramBotToken' | 'telegramChatId'> | null
): void {
  const token = (
    adminConfig?.telegramBotToken ||
    ENV_TELEGRAM_BOT_TOKEN ||
    ''
  ).trim();
  const chatId = (
    adminConfig?.telegramChatId ||
    ENV_TELEGRAM_CHAT_ID ||
    ''
  ).trim();

  if (!token || !chatId || typeof fetch === 'undefined') {
    return;
  }

  const timestamp = new Date().toISOString();
  const text = [
    `Onyx AI OS Alert (v${APP_VERSION})`,
    `Error: ${payload.errorCode}`,
    `Provider: ${payload.provider}`,
    payload.mode ? `Mode: ${payload.mode}` : null,
    payload.detail ? `Detail: ${payload.detail.slice(0, 180)}` : null,
    `Time: ${timestamp}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    void fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_notification: true,
      }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Strictly silent: never surface telemetry failures to end users
  }
}
