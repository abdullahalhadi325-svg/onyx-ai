import type { PdfVaultInfo } from '../types/onyx';

export type SpeechLanguageCode = 'en-US' | 'bn-BD';

export const FRIENDLY_ENGINE_ERROR_MESSAGE =
  'Connection hiccup — the AI engine took too long or a provider failed.';

export function buildPollinationsImageUrl(prompt: string): string {
  const cleaned =
    prompt.trim() || 'minimal dark obsidian architectural monolith';
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    cleaned
  )}?model=flux&nologo=true`;
}

export function isPreviewableCodeLanguage(language?: string): boolean {
  if (!language) {
    return false;
  }
  const normalized = language.trim().toLowerCase();
  return normalized === 'html' || normalized === 'svg';
}

export function buildPreviewSrcDoc(code: string, language?: string): string {
  const normalized = (language ?? '').trim().toLowerCase();
  const trimmed = code.trim();

  if (normalized === 'svg' || /^<svg[\s>]/i.test(trimmed)) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 16px;
        min-height: 100%;
        background: #000000;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }
      svg {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>${trimmed}</body>
</html>`;
  }

  if (/<html[\s>]|<!doctype/i.test(trimmed)) {
    return trimmed;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 16px;
        background: #000000;
        color: #ffffff;
        font-family: system-ui, -apple-system, sans-serif;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>${trimmed}</body>
</html>`;
}

export function extractPdfMessageId(
  pdfVault?: PdfVaultInfo | null
): string | null {
  if (!pdfVault) {
    return null;
  }
  if (pdfVault.messageId && pdfVault.messageId.trim()) {
    return pdfVault.messageId.trim();
  }
  return null;
}

export function formatDownloadFilename(
  label: string,
  extension: string = 'png'
): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${slug || 'onyx-image'}.${extension}`;
}

export function getThinkingStatusLabel(
  routingMode: 'auto' | 'flash' | 'deep-research' | 'deep-think',
  inputMode: 'chat' | 'task'
): string {
  if (inputMode === 'task') {
    return 'Planning tasks...';
  }
  switch (routingMode) {
    case 'deep-research':
      return 'Searching web...';
    case 'deep-think':
      return 'Auditing...';
    case 'flash':
      return 'Onyx is thinking...';
    case 'auto':
    default:
      return 'Onyx is routing...';
  }
}

export function isBackendEngineError(content?: string | null): boolean {
  if (!content) {
    return false;
  }
  return /^\s*backend engine error\s*:/i.test(content);
}

export function extractErrorDiagnostic(raw?: string | null): string | undefined {
  if (!raw || !raw.trim()) {
    return undefined;
  }
  const cleaned = raw
    .replace(/^\s*backend engine error\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return undefined;
  }
  return cleaned.length > 140 ? `${cleaned.slice(0, 137)}...` : cleaned;
}

export function sanitizeAssistantErrorMessage(raw?: string | null): string {
  if (!raw || !raw.trim()) {
    return FRIENDLY_ENGINE_ERROR_MESSAGE;
  }
  return FRIENDLY_ENGINE_ERROR_MESSAGE;
}

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

/**
 * Safely prunes corrupted Onyx-owned localStorage keys during boot pre-flight
 * without ever touching Supabase auth session tokens (sb-*).
 */
export function pruneCorruptedOnyxStorage(storage: StorageLike): string[] {
  const removed: string[] = [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith('onyx_')) {
        keys.push(key);
      }
    }

    for (const key of keys) {
      const value = storage.getItem(key);
      if (value === null || value === '' || value === 'undefined') {
        storage.removeItem(key);
        removed.push(key);
        continue;
      }
      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          JSON.parse(value);
        } catch {
          storage.removeItem(key);
          removed.push(key);
        }
      }
    }
  } catch {
    // Ignore storage access restrictions (private mode / WebView policies)
  }
  return removed;
}

export function createBranchedMessages<T extends { id: string }>(
  messages: T[],
  targetMessageId: string
): T[] {
  const index = messages.findIndex((msg) => msg.id === targetMessageId);
  if (index === -1) {
    return [...messages];
  }
  return messages.slice(0, index + 1);
}
