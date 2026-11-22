import { BACKEND_API_URL } from './config';
import {
  DEFAULT_GLOBAL_SYSTEM_PROMPT,
  sendSilentTelegramErrorAlert,
} from './adminConfig';
import {
  containsBengaliScript,
  isBackendEngineError,
  isValidHttpUrl,
} from './artifacts';
import type {
  AdminConfig,
  BackendChatMode,
  BackendChatRequest,
  BackendChatResponse,
  ConversationHistoryItem,
  ImageAttachmentPayload,
  InputMode,
  LocalServerConfig,
  MediaCard,
  PersonaId,
  ResponseTone,
  RoutingModeId,
  SourceItem,
} from '../types/onyx';

export const REQUEST_TIMEOUT_MS = 45000;
export const MAX_SILENT_FAILOVER_ATTEMPTS = 3;
export const MAX_CONVERSATION_HISTORY_MESSAGES = 16;

export const BENGALI_SYSTEM_INSTRUCTION =
  'Respond in pure, grammatically natural Bengali script without mixing random Chinese characters or broken English words.';

export function mapRoutingModeToApiMode(
  routingMode: RoutingModeId | 'deep_research' | 'deep_think',
  inputMode: InputMode
): BackendChatMode {
  if (inputMode === 'task') {
    return 'task';
  }

  switch (routingMode) {
    case 'deep-research':
    case 'deep_research':
      return 'research';
    case 'deep-think':
    case 'deep_think':
      return 'deep_think';
    case 'flash':
    case 'auto':
    default:
      return 'flash';
  }
}

export function getEnabledProviderList(adminConfig?: AdminConfig): string[] {
  const toggles = adminConfig?.enabledProviders;
  if (!toggles) {
    return ['gemini', 'groq', 'openrouter', 'cloudflare'];
  }
  const active = (
    Object.entries(toggles) as Array<[string, boolean]>
  )
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);

  return active.length > 0 ? active : ['gemini'];
}

export function sanitizeConversationHistory(
  history?: ConversationHistoryItem[]
): ConversationHistoryItem[] {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  return history
    .filter(
      (item): item is ConversationHistoryItem =>
        Boolean(item) &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim().length > 0
    )
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }))
    .slice(-MAX_CONVERSATION_HISTORY_MESSAGES);
}

export function hasBengaliInConversation(
  message: string,
  history: ConversationHistoryItem[]
): boolean {
  if (containsBengaliScript(message)) {
    return true;
  }
  return history.some((item) => containsBengaliScript(item.content));
}

export function buildChatRequestPayload(params: {
  userId: string | null | undefined;
  message: string;
  history?: ConversationHistoryItem[];
  routingMode: RoutingModeId;
  inputMode: InputMode;
  persona: PersonaId;
  tone?: ResponseTone;
  adminConfig?: AdminConfig;
  attachedImage?: ImageAttachmentPayload | null;
}): BackendChatRequest {
  const hasVisionImage = Boolean(params.attachedImage?.base64Data);
  const recentHistory = sanitizeConversationHistory(params.history);
  const trimmedMessage = params.message.trim();
  const isBengaliConversation = hasBengaliInConversation(
    trimmedMessage,
    recentHistory
  );

  const baseSystemPrompt =
    params.adminConfig?.globalSystemPrompt?.trim() ||
    DEFAULT_GLOBAL_SYSTEM_PROMPT;
  const systemPrompt = isBengaliConversation
    ? `${baseSystemPrompt}\n\n${BENGALI_SYSTEM_INSTRUCTION}`
    : baseSystemPrompt;

  const fullMessages: ConversationHistoryItem[] = [
    ...recentHistory,
    { role: 'user', content: trimmedMessage },
  ];

  const forceGemini = hasVisionImage || isBengaliConversation;

  const contextualMessage =
    recentHistory.length > 0
      ? "[Previous Conversation]\n" +
        recentHistory
          .slice(-10)
          .map((m) => (m.role === "user" ? "User: " : "Assistant: ") + m.content)
          .join("\n") +
        "\n\n[Current Message]\nUser: " +
        trimmedMessage
      : trimmedMessage;

  const payload: BackendChatRequest = {
    message: contextualMessage,
    messages: fullMessages,
    history: recentHistory,
    mode: mapRoutingModeToApiMode(params.routingMode, params.inputMode),
    persona: params.persona,
    user_id: params.userId || null,
    system_prompt: systemPrompt,
    tone: params.tone ?? 'direct',
    language: isBengaliConversation ? 'bn' : 'en',
    preferred_providers: forceGemini
      ? ['gemini']
      : getEnabledProviderList(params.adminConfig),
  };

  if (forceGemini) {
    payload.force_provider = 'gemini';
  }

  if (hasVisionImage && params.attachedImage) {
    payload.vision = true;
    payload.image_base64 = params.attachedImage.base64Data;
    payload.image_mime_type = params.attachedImage.mimeType;
    payload.attachments = [
      {
        type: 'image',
        mimeType: params.attachedImage.mimeType,
        data: params.attachedImage.base64Data,
        fileName: params.attachedImage.fileName,
      },
    ];
  }

  return payload;
}

function normalizeThinkingLog(raw: unknown): string | null {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(raw)) {
    const joined = raw
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .filter(Boolean)
      .join('\n');
    return joined.trim() || null;
  }
  if (typeof raw === 'object') {
    return JSON.stringify(raw, null, 2);
  }
  return null;
}

export function normalizeMediaCards(raw: unknown): MediaCard[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const cards: MediaCard[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      cards.push({ url: item.trim(), imageUrl: item.trim() });
    } else if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const imageUrl =
        typeof record.image_url === 'string'
          ? record.image_url
          : typeof record.imageUrl === 'string'
            ? record.imageUrl
            : typeof record.thumbnail === 'string'
              ? record.thumbnail
              : undefined;
      const url =
        typeof record.url === 'string'
          ? record.url
          : typeof record.link === 'string'
            ? record.link
            : imageUrl;
      const title =
        typeof record.title === 'string'
          ? record.title
          : typeof record.name === 'string'
            ? record.name
            : undefined;
      const caption =
        typeof record.caption === 'string'
          ? record.caption
          : typeof record.description === 'string'
            ? record.description
            : undefined;
      const kind = typeof record.type === 'string' ? record.type : undefined;

      if (title || url || imageUrl || caption) {
        cards.push({ title, url, imageUrl, caption, kind });
      }
    }
  }
  return cards;
}

function normalizeSources(raw: unknown): SourceItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const items: SourceItem[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      const cleaned = item.trim();
      items.push({
        title: cleaned,
        url: /^https?:\/\//i.test(cleaned) ? cleaned : undefined,
      });
    } else if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const url =
        typeof record.url === 'string'
          ? record.url
          : typeof record.href === 'string'
            ? record.href
            : typeof record.link === 'string'
              ? record.link
              : undefined;
      const title =
        typeof record.title === 'string' && record.title.trim()
          ? record.title.trim()
          : url || 'Reference source';
      const snippet =
        typeof record.snippet === 'string'
          ? record.snippet
          : typeof record.summary === 'string'
            ? record.summary
            : undefined;
      items.push({ title, url, snippet });
    }
  }
  return items;
}

export function normalizeBackendResponse(raw: unknown): BackendChatResponse {
  if (!raw || typeof raw !== 'object') {
    return {
      answer: '',
      provider: 'error',
      error: 'Empty response from engine',
      thinking_log: null,
      media_cards: [],
      sources: [],
    };
  }

  const record = raw as Record<string, unknown>;
  const provider =
    typeof record.provider === 'string' ? record.provider.trim() : null;
  const errorStr =
    typeof record.error === 'string'
      ? record.error.trim()
      : typeof record.detail === 'string'
        ? record.detail.trim()
        : null;

  const answer =
    typeof record.answer === 'string' && record.answer.trim()
      ? record.answer.trim()
      : typeof record.response === 'string' && record.response.trim()
        ? record.response.trim()
        : typeof record.message === 'string' && record.message.trim()
          ? record.message.trim()
          : '';

  const usageRaw =
    record.usage && typeof record.usage === 'object'
      ? (record.usage as Record<string, unknown>)
      : null;

  return {
    answer,
    provider,
    error: errorStr,
    thinking_log: normalizeThinkingLog(record.thinking_log),
    media_cards: normalizeMediaCards(record.media_cards),
    sources: normalizeSources(record.sources),
    usage: usageRaw
      ? {
          inputTokens:
            typeof usageRaw.prompt_tokens === 'number'
              ? usageRaw.prompt_tokens
              : typeof usageRaw.input_tokens === 'number'
                ? usageRaw.input_tokens
                : undefined,
          outputTokens:
            typeof usageRaw.completion_tokens === 'number'
              ? usageRaw.completion_tokens
              : typeof usageRaw.output_tokens === 'number'
                ? usageRaw.output_tokens
                : undefined,
        }
      : undefined,
  };
}

interface SingleAttemptResult {
  ok: boolean;
  response?: BackendChatResponse;
  errorCode?: string;
  provider?: string;
  detail?: string;
  isNetworkOffline?: boolean;
}

async function executeCloudAttempt(
  payload: BackendChatRequest
): Promise<SingleAttemptResult> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${BACKEND_API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = response.statusText || '';
      try {
        const text = await response.text();
        if (text) {
          detail = text.slice(0, 160);
        }
      } catch {
        // Ignore unreadable body
      }
      return {
        ok: false,
        errorCode: `HTTP_${response.status}`,
        provider: payload.force_provider || payload.preferred_providers?.[0] || 'cloudflare-worker',
        detail,
      };
    }

    const data: unknown = await response.json();
    const normalized = normalizeBackendResponse(data);

    if (
      !normalized.answer ||
      normalized.provider?.toLowerCase() === 'error' ||
      isBackendEngineError(normalized.answer)
    ) {
      return {
        ok: false,
        errorCode: 'PROVIDER_ERROR',
        provider: normalized.provider || 'upstream-pool',
        detail: normalized.error || normalized.answer || 'Provider returned error',
      };
    }

    return { ok: true, response: normalized };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        ok: false,
        errorCode: 'TIMEOUT_45S',
        provider: payload.force_provider || 'cloudflare-worker',
        detail: 'Request timed out after 45s',
      };
    }

    const offline =
      typeof navigator !== 'undefined' && navigator.onLine === false;
    return {
      ok: false,
      errorCode: offline ? 'CLIENT_OFFLINE' : 'NETWORK_ERROR',
      provider: 'cloudflare-worker',
      detail: error instanceof Error ? error.message : 'Fetch failed',
      isNetworkOffline: true,
    };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export interface CloudFailoverOutcome {
  ok: boolean;
  response?: BackendChatResponse;
  isOffline: boolean;
}

/**
 * Executes up to 3 silent failover attempts across fallback modes/providers.
 * Fires silent Telegram developer alerts on upstream failures without surfacing raw errors to users.
 */
export async function sendChatWithSilentFailover(params: {
  payload: BackendChatRequest;
  adminConfig?: AdminConfig;
  onStatusChange?: (status: string) => void;
}): Promise<CloudFailoverOutcome> {
  const { payload, adminConfig, onStatusChange } = params;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, isOffline: true };
  }

  const enabledProviders = getEnabledProviderList(adminConfig);
  const preferGeminiOnly =
    Boolean(payload.vision) ||
    payload.force_provider === 'gemini' ||
    payload.language === 'bn';

  const attempts: Array<{ label: string; req: BackendChatRequest }> = (
    [
      {
        label: payload.vision ? 'Analyzing image...' : 'Thinking...',
        req: payload,
      },
      {
        label: 'Connecting engine...',
        req: {
          ...payload,
          mode: 'flash' as BackendChatMode,
          preferred_providers: preferGeminiOnly
            ? ['gemini']
            : enabledProviders.slice(1).concat(enabledProviders.slice(0, 1)),
          force_provider: preferGeminiOnly ? 'gemini' : payload.force_provider,
        },
      },
      {
        label: 'Connecting engine...',
        req: {
          ...payload,
          mode: 'flash' as BackendChatMode,
          preferred_providers: preferGeminiOnly
            ? ['gemini', ...enabledProviders.filter((p) => p !== 'gemini')]
            : enabledProviders,
          force_provider: payload.vision ? 'gemini' : undefined,
        },
      },
    ] satisfies Array<{ label: string; req: BackendChatRequest }>
  ).slice(0, MAX_SILENT_FAILOVER_ATTEMPTS);

  let sawOffline = false;

  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    onStatusChange?.(attempt.label);

    const result = await executeCloudAttempt(attempt.req);
    if (result.ok && result.response) {
      return { ok: true, response: result.response, isOffline: false };
    }

    if (result.isNetworkOffline) {
      sawOffline = true;
    }

    // Silent background developer alert to Telegram Bot API (never shown to user)
    if (result.errorCode && result.errorCode !== 'CLIENT_OFFLINE') {
      sendSilentTelegramErrorAlert(
        {
          errorCode: result.errorCode,
          provider: result.provider || 'unknown',
          detail: result.detail,
          mode: attempt.req.mode,
        },
        adminConfig
      );
    }

    // If definitely offline, skip further retries immediately
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { ok: false, isOffline: true };
    }

    if (i < attempts.length - 1) {
      await sleep(350);
    }
  }

  return { ok: false, isOffline: sawOffline };
}

/**
 * Sends chat completion request directly to an OpenAI-compatible Local LLM server
 * running on-device (Termux llama.cpp, PocketPal, Ollama).
 */
export async function sendChatToLocalServer(params: {
  config: LocalServerConfig;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemPrompt: string;
  attachedImage?: ImageAttachmentPayload | null;
}): Promise<{ ok: boolean; response?: BackendChatResponse }> {
  const { config, message, history, systemPrompt, attachedImage } = params;

  if (!isValidHttpUrl(config.endpointUrl)) {
    return { ok: false };
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const userContent = attachedImage?.base64Data
      ? [
          { type: 'text', text: message },
          {
            type: 'image_url',
            image_url: {
              url: `data:${attachedImage.mimeType};base64,${attachedImage.base64Data}`,
            },
          },
        ]
      : message;

    const recentHistory = sanitizeConversationHistory(history);
    const isBengaliConversation = hasBengaliInConversation(
      message,
      recentHistory
    );
    const basePrompt = systemPrompt || DEFAULT_GLOBAL_SYSTEM_PROMPT;
    const finalSystemPrompt = isBengaliConversation
      ? `${basePrompt}\n\n${BENGALI_SYSTEM_INSTRUCTION}`
      : basePrompt;

    const messagesPayload = [
      { role: 'system', content: finalSystemPrompt },
      ...recentHistory.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      { role: 'user', content: userContent },
    ];

    const res = await fetch(config.endpointUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: config.modelName.trim() || 'local-model',
        messages: messagesPayload,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; text?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const answer =
      data.choices?.[0]?.message?.content?.trim() ||
      data.choices?.[0]?.text?.trim() ||
      '';

    if (!answer) {
      return { ok: false };
    }

    return {
      ok: true,
      response: {
        answer,
        provider: 'local-llm',
        thinking_log: null,
        media_cards: [],
        sources: [],
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
        },
      },
    };
  } catch {
    return { ok: false };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function checkLocalServerHealth(
  endpointUrl: string
): Promise<{ connected: boolean; latencyMs?: number }> {
  if (!isValidHttpUrl(endpointUrl)) {
    return { connected: false };
  }

  const parsed = new URL(endpointUrl.trim());
  const baseOrigin = parsed.origin;
  const probeUrls = [`${baseOrigin}/v1/models`, `${baseOrigin}/health`];

  const startedAt = Date.now();
  for (const probeUrl of probeUrls) {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), 4500);
    try {
      const res = await fetch(probeUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      if (res.ok || res.status === 401 || res.status === 404) {
        return { connected: true, latencyMs: Date.now() - startedAt };
      }
    } catch {
      // Try next probe
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  return { connected: false };
}
