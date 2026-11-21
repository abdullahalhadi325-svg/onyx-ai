import { matchOnyxIdentityIntent } from './onyxIdentity';
import {
  BENGALI_SYSTEM_INSTRUCTION,
  hasBengaliInConversation,
  sanitizeConversationHistory,
} from './api';
import { DEFAULT_GLOBAL_SYSTEM_PROMPT } from './adminConfig';
import type {
  CapacitorPluginListenerHandle,
  ConversationHistoryItem,
  LocalLLMCompleteEvent,
  LocalLLMDownloadProgressEvent,
  LocalLLMErrorEvent,
  LocalLLMInventoryResponse,
  LocalLLMTokenEvent,
  NativeLocalLLMPlugin,
} from '../types/onyx';

interface CapacitorWindow extends Window {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: {
      LocalLLM?: NativeLocalLLMPlugin;
    };
  };
}

export const STORAGE_HEADROOM_BYTES = 350 * 1024 * 1024; // 350 MB safety buffer

export function getNativeLocalLLMPlugin(): NativeLocalLLMPlugin | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  const win = (globalThis as unknown as { window?: CapacitorWindow }).window;
  const plugin = win?.Capacitor?.Plugins?.LocalLLM;
  if (!plugin || typeof plugin.generate !== 'function') {
    return null;
  }
  return plugin;
}

export function isNativeLocalLLMAvailable(): boolean {
  return getNativeLocalLLMPlugin() !== null;
}

export function parseModelSizeToBytes(sizeLabel: string): number {
  const match = /^\s*([\d.]+)\s*(gb|mb|kb|b)?\s*$/i.exec(sizeLabel);
  if (!match) {
    return 0;
  }
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  const unit = (match[2] ?? 'mb').toLowerCase();
  switch (unit) {
    case 'gb':
      return Math.round(value * 1024 * 1024 * 1024);
    case 'mb':
      return Math.round(value * 1024 * 1024);
    case 'kb':
      return Math.round(value * 1024);
    default:
      return Math.round(value);
  }
}

export function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 MB';
  }
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function formatMB(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0.0 MB';
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function hasEnoughStorageForModel(
  availableBytes: number,
  modelSizeBytes: number
): boolean {
  if (availableBytes <= 0 || modelSizeBytes <= 0) {
    return true;
  }
  return availableBytes >= modelSizeBytes + STORAGE_HEADROOM_BYTES;
}

export async function getNativeDownloadedModels(): Promise<LocalLLMInventoryResponse | null> {
  const plugin = getNativeLocalLLMPlugin();
  if (!plugin) {
    return null;
  }
  return plugin.getDownloadedModels();
}

export async function startNativeModelDownload(params: {
  url: string;
  fileName: string;
  modelId: string;
}): Promise<{
  fileName: string;
  sizeBytes?: number;
  status: string;
}> {
  const plugin = getNativeLocalLLMPlugin();
  if (!plugin) {
    throw new Error('Native Android LocalLLM bridge is unavailable in browser mode.');
  }
  return plugin.downloadModel(params);
}

export async function pauseNativeModelDownload(fileName: string): Promise<void> {
  const plugin = getNativeLocalLLMPlugin();
  if (!plugin) {
    return;
  }
  await plugin.pauseDownload({ fileName });
}

export async function cancelNativeModelDownload(fileName: string): Promise<void> {
  const plugin = getNativeLocalLLMPlugin();
  if (!plugin) {
    return;
  }
  await plugin.cancelDownload({ fileName });
}

export async function deleteNativeModel(fileName: string): Promise<boolean> {
  const plugin = getNativeLocalLLMPlugin();
  if (!plugin) {
    return false;
  }
  const res = await plugin.deleteModel({ fileName });
  return Boolean(res.deleted);
}

export async function loadNativeModel(params: {
  fileName: string;
  nCtx?: number;
  nThreads?: number;
}): Promise<{ loaded: boolean; fileName: string; nCtx: number; nThreads: number }> {
  const plugin = getNativeLocalLLMPlugin();
  if (!plugin) {
    throw new Error('Native Android LocalLLM bridge is unavailable.');
  }
  return plugin.loadModel({ ...params, nCtx: params.nCtx ?? 2048, nThreads: params.nThreads ?? 4 });
}

export async function unloadNativeModel(): Promise<void> {
  const plugin = getNativeLocalLLMPlugin();
  if (!plugin) {
    return;
  }
  await plugin.unloadModel();
}

export async function stopNativeGeneration(): Promise<void> {
  const plugin = getNativeLocalLLMPlugin();
  if (!plugin) {
    return;
  }
  await plugin.stopGeneration();
}

export async function subscribeToNativeDownloadProgress(
  listener: (event: LocalLLMDownloadProgressEvent) => void
): Promise<(() => void) | null> {
  const plugin = getNativeLocalLLMPlugin();
  if (!plugin || typeof plugin.addListener !== 'function') {
    return null;
  }
  const handle = await plugin.addListener('downloadProgress', listener);
  return () => {
    try {
      void handle.remove();
    } catch {
      // Ignore cleanup error
    }
  };
}

export interface NativeGenerateStreamOutcome {
  ok: boolean;
  text: string;
  tokensGenerated?: number;
  tokensPerSecond?: number;
  error?: string;
}

/**
 * Streams offline inference tokens directly from the Android C++ llama.cpp JNI engine
 * via Capacitor plugin event listeners (`onToken`, `onComplete`, `onError`).
 */
export async function generateWithNativeLocalLLM(params: {
  message: string;
  history: ConversationHistoryItem[];
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  onToken?: (token: string, accumulatedText: string) => void;
  onComplete?: (event: LocalLLMCompleteEvent) => void;
  onError?: (message: string) => void;
}): Promise<NativeGenerateStreamOutcome> {
  const plugin = getNativeLocalLLMPlugin();
  if (!plugin) {
    return {
      ok: false,
      text: '',
      error: 'Native LocalLLM bridge is not available.',
    };
  }

  const recentHistory = sanitizeConversationHistory(params.history);
  const trimmedMessage = params.message.trim();
  const identityReply = matchOnyxIdentityIntent(trimmedMessage);
  if (identityReply) {
    params.onToken?.(identityReply, identityReply);
    return { ok: true, text: identityReply };
  }
  const isBengali = hasBengaliInConversation(trimmedMessage, recentHistory);
  const baseSystemPrompt =
    params.systemPrompt.trim() || DEFAULT_GLOBAL_SYSTEM_PROMPT;
  const finalSystemPrompt = isBengali
    ? `${baseSystemPrompt}\n\n${BENGALI_SYSTEM_INSTRUCTION}`
    : baseSystemPrompt;

  const fullMessages: ConversationHistoryItem[] = [
    ...recentHistory,
    { role: 'user', content: trimmedMessage },
  ];

  const requestId = `native-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const handles: CapacitorPluginListenerHandle[] = [];
  let accumulated = '';
  let lastEmitTime = 0;
  let pendingToken = '';
  let completedEvent: LocalLLMCompleteEvent | null = null;
  let errorMessage: string | null = null;

  try {
    if (typeof plugin.addListener === 'function') {
      handles.push(
        await plugin.addListener('onToken', (event: LocalLLMTokenEvent) => {
          if (event.requestId && event.requestId !== requestId) {
            return;
          }
          if (event.token) {
            accumulated += event.token;
            pendingToken += event.token;
            const now = Date.now();
            if (now - lastEmitTime >= 60) {
              params.onToken?.(pendingToken, accumulated);
              pendingToken = '';
              lastEmitTime = now;
            }
          }
        })
      );

      handles.push(
        await plugin.addListener('onComplete', (event: LocalLLMCompleteEvent) => {
          if (event.requestId && event.requestId !== requestId) {
            return;
          }
          completedEvent = event;
          params.onComplete?.(event);
        })
      );

      handles.push(
        await plugin.addListener('onError', (event: LocalLLMErrorEvent) => {
          if (event.requestId && event.requestId !== requestId) {
            return;
          }
          errorMessage = event.message || 'Local inference failed';
          params.onError?.(errorMessage);
        })
      );
    }

    const result = await plugin.generate({
      requestId,
      prompt: trimmedMessage,
      systemPrompt: finalSystemPrompt,
      messages: fullMessages,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    const finalText = (
      result?.text ||
      (completedEvent as LocalLLMCompleteEvent | null)?.text ||
      accumulated
    ).trim();

    if (errorMessage && !finalText) {
      return { ok: false, text: '', error: errorMessage };
    }

    if (pendingToken) {
      params.onToken?.(pendingToken, finalText || accumulated);
      pendingToken = '';
    }
    if (!finalText) {
      return { ok: false, text: '', error: 'Local model produced an empty response.' };
    }

    return {
      ok: true,
      text: finalText,
      tokensGenerated:
        result?.tokensGenerated ??
        (completedEvent as LocalLLMCompleteEvent | null)?.tokensGenerated,
      tokensPerSecond:
        result?.tokensPerSecond ??
        (completedEvent as LocalLLMCompleteEvent | null)?.tokensPerSecond,
    };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Native local inference failed';
    if (accumulated.trim().length > 0) {
      return { ok: true, text: accumulated.trim() };
    }
    params.onError?.(msg);
    return { ok: false, text: '', error: msg };
  } finally {
    for (const handle of handles) {
      try {
        await handle.remove();
      } catch {
        // Ignore listener removal errors
      }
    }
  }
}
