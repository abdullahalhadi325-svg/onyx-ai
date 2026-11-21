import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatBytesCompact,
  formatMB,
  generateWithNativeLocalLLM,
  getNativeDownloadedModels,
  hasEnoughStorageForModel,
  isNativeLocalLLMAvailable,
  loadNativeModel,
  parseModelSizeToBytes,
} from './localLLM';
import type {
  CapacitorPluginListenerHandle,
  LocalLLMCompleteEvent,
  LocalLLMErrorEvent,
  LocalLLMTokenEvent,
  NativeLocalLLMPlugin,
} from '../types/onyx';

function setMockCapacitorLocalLLM(plugin?: NativeLocalLLMPlugin) {
  const g = globalThis as unknown as {
    window?: {
      Capacitor?: {
        Plugins?: {
          LocalLLM?: NativeLocalLLMPlugin;
        };
      };
    };
  };
  if (!plugin) {
    delete g.window;
  } else {
    g.window = {
      Capacitor: {
        Plugins: {
          LocalLLM: plugin,
        },
      },
    };
  }
}

test('storage parsing, formatting, and headroom validation', () => {
  const twoGb = parseModelSizeToBytes('2.0 GB');
  assert.equal(twoGb, 2 * 1024 * 1024 * 1024);
  assert.equal(formatBytesCompact(twoGb), '2.00 GB');
  assert.equal(formatMB(512 * 1024 * 1024), '512.0 MB');
  assert.equal(hasEnoughStorageForModel(2.5 * 1024 * 1024 * 1024, twoGb), true);
  assert.equal(hasEnoughStorageForModel(2.1 * 1024 * 1024 * 1024, twoGb), false);
});

test('isNativeLocalLLMAvailable returns false in plain browser environments', () => {
  setMockCapacitorLocalLLM(undefined);
  assert.equal(isNativeLocalLLMAvailable(), false);
});

test('generateWithNativeLocalLLM streams tokens via Capacitor listeners and cleans up handlers', async () => {
  const listeners: {
    onToken?: (e: LocalLLMTokenEvent) => void;
    onComplete?: (e: LocalLLMCompleteEvent) => void;
    onError?: (e: LocalLLMErrorEvent) => void;
  } = {};
  let removedCount = 0;
  let capturedSystemPrompt = '';
  let capturedMessageCount = 0;

  const mockPlugin: NativeLocalLLMPlugin = {
    downloadModel: async () => ({
      fileName: 'qwen2.5-3b-instruct-q4_k_m.gguf',
      status: 'completed',
    }),
    pauseDownload: async () => ({ paused: true }),
    cancelDownload: async () => ({ cancelled: true }),
    getDownloadedModels: async () => ({
      models: [
        {
          fileName: 'qwen2.5-3b-instruct-q4_k_m.gguf',
          sizeBytes: 1930000000,
          sizeMB: 1840.6,
          lastModified: Date.now(),
          isLoaded: true,
        },
      ],
      partials: [],
      loadedModel: 'qwen2.5-3b-instruct-q4_k_m.gguf',
      availableStorageBytes: 12000000000,
      totalStorageBytes: 64000000000,
      modelsStorageBytes: 1930000000,
      nativeReady: true,
    }),
    deleteModel: async () => ({
      deleted: true,
      fileName: 'qwen2.5-3b-instruct-q4_k_m.gguf',
    }),
    loadModel: async ({ fileName }) => ({
      loaded: true,
      fileName,
      nCtx: 2048,
      nThreads: 6,
    }),
    unloadModel: async () => ({ unloaded: true }),
    stopGeneration: async () => ({ stopped: true }),
    addListener: async (
      eventName: string,
      listenerFunc: (event: never) => void
    ): Promise<CapacitorPluginListenerHandle> => {
      if (eventName === 'onToken') {
        listeners.onToken = listenerFunc as (e: LocalLLMTokenEvent) => void;
      } else if (eventName === 'onComplete') {
        listeners.onComplete = listenerFunc as (e: LocalLLMCompleteEvent) => void;
      } else if (eventName === 'onError') {
        listeners.onError = listenerFunc as (e: LocalLLMErrorEvent) => void;
      }
      return {
        remove: () => {
          removedCount += 1;
        },
      };
    },
    generate: async (options) => {
      capturedSystemPrompt = options.systemPrompt ?? '';
      capturedMessageCount = options.messages?.length ?? 0;
      listeners.onToken?.({ requestId: options.requestId, token: 'হ্যালো ' });
      listeners.onToken?.({ requestId: options.requestId, token: 'হাদি!' });
      const done: LocalLLMCompleteEvent = {
        requestId: options.requestId,
        text: 'হ্যালো হাদি!',
        tokensGenerated: 4,
        tokensPerSecond: 14.2,
      };
      listeners.onComplete?.(done);
      return done;
    },
  };

  setMockCapacitorLocalLLM(mockPlugin);
  try {
    assert.equal(isNativeLocalLLMAvailable(), true);
    const inventory = await getNativeDownloadedModels();
    assert.equal(inventory?.models.length, 1);

    const loadRes = await loadNativeModel({
      fileName: 'qwen2.5-3b-instruct-q4_k_m.gguf',
    });
    assert.equal(loadRes.loaded, true);

    const streamedChunks: string[] = [];
    const outcome = await generateWithNativeLocalLLM({
      message: 'আমার নাম হাদি',
      history: [{ role: 'user', content: 'Hi' }],
      systemPrompt: 'You are Onyx.',
      temperature: 0.7,
      maxTokens: 256,
      onToken: (token) => streamedChunks.push(token),
    });

    assert.equal(outcome.ok, true);
    assert.equal(outcome.text, 'হ্যালো হাদি!');
    assert.deepEqual(streamedChunks, ['হ্যালো ', 'হাদি!']);
    assert.equal(capturedMessageCount, 2);
    assert.ok(capturedSystemPrompt.includes('pure, grammatically natural Bengali script'));
    assert.equal(removedCount, 3);
  } finally {
    setMockCapacitorLocalLLM(undefined);
  }
});
