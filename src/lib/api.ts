import { BACKEND_API_URL } from './config';
import {
  FRIENDLY_ENGINE_ERROR_MESSAGE,
  extractErrorDiagnostic,
  isBackendEngineError,
} from './artifacts';
import type {
  BackendChatMode,
  BackendChatRequest,
  BackendChatResponse,
  InputMode,
  MediaCard,
  PdfVaultInfo,
  PersonaId,
  RoutingModeId,
  SourceItem,
} from '../types/onyx';

export const REQUEST_TIMEOUT_MS = 25000;

export class OnyxBackendError extends Error {
  public readonly diagnostic: string;

  constructor(message: string, diagnostic: string) {
    super(message);
    this.name = 'OnyxBackendError';
    this.diagnostic = diagnostic;
  }
}

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

export function buildChatRequestPayload(params: {
  userId: string | null | undefined;
  message: string;
  routingMode: RoutingModeId;
  inputMode: InputMode;
  persona: PersonaId;
  generatePdf: boolean;
}): BackendChatRequest {
  return {
    message: params.message,
    mode: mapRoutingModeToApiMode(params.routingMode, params.inputMode),
    persona: params.persona,
    user_id: params.userId || null,
    generate_pdf: params.generatePdf,
  };
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

function normalizePdfVault(raw: unknown): PdfVaultInfo | null {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    return /^https?:\/\//i.test(trimmed)
      ? { status: 'Synced to Telegram Vault', url: trimmed }
      : { status: trimmed };
  }
  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const status =
      typeof record.status === 'string'
        ? record.status
        : record.sent === true || record.success === true
          ? 'Delivered to Telegram Vault'
          : undefined;
    const filename =
      typeof record.filename === 'string'
        ? record.filename
        : typeof record.file_name === 'string'
          ? record.file_name
          : typeof record.title === 'string'
            ? record.title
            : undefined;
    const url =
      typeof record.url === 'string'
        ? record.url
        : typeof record.download_url === 'string'
          ? record.download_url
          : undefined;
    const message =
      typeof record.message === 'string' ? record.message : undefined;
    const rawMessageId =
      record.message_id ??
      record.messageId ??
      record.telegram_message_id ??
      record.id;
    const messageId =
      typeof rawMessageId === 'string' && rawMessageId.trim()
        ? rawMessageId.trim()
        : typeof rawMessageId === 'number'
          ? String(rawMessageId)
          : undefined;

    if (status || filename || url || message || messageId) {
      return { status, filename, url, message, messageId };
    }
  }
  return null;
}

export function normalizeBackendResponse(raw: unknown): BackendChatResponse {
  if (!raw || typeof raw !== 'object') {
    return {
      answer: 'Received an empty response from Onyx backend.',
      provider: null,
      error: null,
      thinking_log: null,
      media_cards: [],
      sources: [],
      pdf_vault: null,
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
          : errorStr || 'No answer text returned by the backend.';

  return {
    answer,
    provider,
    error: errorStr,
    thinking_log: normalizeThinkingLog(record.thinking_log),
    media_cards: normalizeMediaCards(record.media_cards),
    sources: normalizeSources(record.sources),
    pdf_vault: normalizePdfVault(record.pdf_vault),
  };
}

export async function sendChatToBackend(
  payload: BackendChatRequest
): Promise<BackendChatResponse> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  const endpoint = `${BACKEND_API_URL}/api/chat`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const text = await response.text();
        if (text) {
          try {
            const parsed = JSON.parse(text) as {
              detail?: string;
              message?: string;
              error?: string;
              answer?: string;
            };
            detail =
              parsed.detail ||
              parsed.error ||
              parsed.message ||
              parsed.answer ||
              text.slice(0, 120);
          } catch {
            detail = text.slice(0, 120);
          }
        }
      } catch {
        detail = '';
      }

      const diagnostic = detail
        ? `HTTP ${response.status} · ${extractErrorDiagnostic(detail) || response.statusText}`
        : `HTTP ${response.status}${response.statusText ? ` · ${response.statusText}` : ''}`;

      throw new OnyxBackendError(FRIENDLY_ENGINE_ERROR_MESSAGE, diagnostic);
    }

    const data: unknown = await response.json();
    const normalized = normalizeBackendResponse(data);

    if (
      normalized.provider?.toLowerCase() === 'error' ||
      isBackendEngineError(normalized.answer)
    ) {
      const reason =
        extractErrorDiagnostic(normalized.error || normalized.answer) ||
        'Upstream provider returned an error';
      throw new OnyxBackendError(
        FRIENDLY_ENGINE_ERROR_MESSAGE,
        `provider: error · ${reason}`
      );
    }

    return normalized;
  } catch (error) {
    if (error instanceof OnyxBackendError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new OnyxBackendError(
        FRIENDLY_ENGINE_ERROR_MESSAGE,
        'Timeout after 25s · Worker did not respond'
      );
    }
    if (error instanceof TypeError) {
      throw new OnyxBackendError(
        FRIENDLY_ENGINE_ERROR_MESSAGE,
        `Network error · ${error.message || 'Unable to reach Worker'}`
      );
    }
    if (error instanceof Error) {
      throw new OnyxBackendError(
        FRIENDLY_ENGINE_ERROR_MESSAGE,
        extractErrorDiagnostic(error.message) || 'Unexpected backend error'
      );
    }
    throw new OnyxBackendError(
      FRIENDLY_ENGINE_ERROR_MESSAGE,
      'Unexpected backend error'
    );
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
