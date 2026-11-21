export type SpeechLanguageCode = 'en-US' | 'bn-BD';

export const BENGALI_OFFLINE_FALLBACK =
  'আপনার ইন্টারনেট সংযোগটি সম্ভবত বিচ্ছিন্ন বা দুর্বল। নেটওয়ার্ক চেক করে আবার চেষ্টা করুন, আমি সাথে সাথেই উত্তর দেব।';

export const BENGALI_BUSY_FALLBACK =
  'সার্ভার এই মুহূর্তে সাময়িক ব্যস্ত রয়েছে, অনুগ্রহ করে কয়েক সেকেন্ড পর আবার বার্তা পাঠান।';

export const ENGLISH_OFFLINE_FALLBACK =
  'Your internet connection appears to be offline or weak. Please check your network and try again — I will respond right away.';

export const ENGLISH_BUSY_FALLBACK =
  'The servers are experiencing momentary traffic right now. Please send your message again in a few seconds.';

export const LOCAL_SERVER_OFFLINE_FALLBACK_BN =
  'কোনো লোকাল AI মডেল লোড করা নেই বা লোকাল সার্ভার পাওয়া যায়নি। Local AI Hub থেকে একটি GGUF মডেল ডাউনলোড ও লোড করুন, অথবা Cloud AI মোডে সুইচ করুন।';

export const LOCAL_SERVER_OFFLINE_FALLBACK_EN =
  'No on-device GGUF model is loaded and no local server responded at 127.0.0.1:8080. Download and load a model in the Local AI Hub, or switch back to Cloud AI.';

export function containsBengaliScript(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
}

export function buildGracefulFallbackReply(params: {
  prompt: string;
  speechLang: SpeechLanguageCode;
  isOffline: boolean;
  isLocalEngine?: boolean;
}): string {
  const useBengali =
    containsBengaliScript(params.prompt) || params.speechLang === 'bn-BD';

  if (params.isLocalEngine) {
    return useBengali
      ? LOCAL_SERVER_OFFLINE_FALLBACK_BN
      : LOCAL_SERVER_OFFLINE_FALLBACK_EN;
  }

  if (params.isOffline) {
    return useBengali ? BENGALI_OFFLINE_FALLBACK : ENGLISH_OFFLINE_FALLBACK;
  }

  return useBengali ? BENGALI_BUSY_FALLBACK : ENGLISH_BUSY_FALLBACK;
}

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
  inputMode: 'chat' | 'task',
  engineMode: 'cloud' | 'local' = 'cloud'
): string {
  if (engineMode === 'local') {
    return 'Running local model...';
  }
  if (inputMode === 'task') {
    return 'Planning tasks...';
  }
  switch (routingMode) {
    case 'deep-research':
      return 'Searching web...';
    case 'deep-think':
      return 'Thinking deeply...';
    case 'flash':
    case 'auto':
    default:
      return 'Thinking...';
  }
}

export function isBackendEngineError(content?: string | null): boolean {
  if (!content) {
    return false;
  }
  return /^\s*backend engine error\s*:/i.test(content);
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
    // Ignore storage access restrictions
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

export function isValidHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
