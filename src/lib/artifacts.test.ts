import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BENGALI_BUSY_FALLBACK,
  BENGALI_OFFLINE_FALLBACK,
  ENGLISH_BUSY_FALLBACK,
  ENGLISH_OFFLINE_FALLBACK,
  LOCAL_SERVER_OFFLINE_FALLBACK_BN,
  LOCAL_SERVER_OFFLINE_FALLBACK_EN,
  buildGracefulFallbackReply,
  buildPollinationsImageUrl,
  buildPreviewSrcDoc,
  containsBengaliScript,
  createBranchedMessages,
  formatDownloadFilename,
  getThinkingStatusLabel,
  isBackendEngineError,
  isPreviewableCodeLanguage,
  isValidHttpUrl,
  pruneCorruptedOnyxStorage,
} from './artifacts';
import {
  createInitialUsageStats,
  estimateTokenCount,
  exportChatsAsJson,
  exportChatsAsMarkdown,
  recordMessageUsage,
  rolloverUsageIfNewDay,
} from './usage';

test('buildGracefulFallbackReply detects Bengali vs English for offline, busy, and local server states', () => {
  assert.equal(containsBengaliScript('হ্যালো অনিক্স'), true);
  assert.equal(containsBengaliScript('Hello Onyx'), false);

  assert.equal(
    buildGracefulFallbackReply({
      prompt: 'হ্যালো অনিক্স',
      speechLang: 'en-US',
      isOffline: true,
    }),
    BENGALI_OFFLINE_FALLBACK
  );

  assert.equal(
    buildGracefulFallbackReply({
      prompt: 'আজকের আবহাওয়া কেমন?',
      speechLang: 'en-US',
      isOffline: false,
    }),
    BENGALI_BUSY_FALLBACK
  );

  assert.equal(
    buildGracefulFallbackReply({
      prompt: 'Explain transformers',
      speechLang: 'en-US',
      isOffline: true,
    }),
    ENGLISH_OFFLINE_FALLBACK
  );

  assert.equal(
    buildGracefulFallbackReply({
      prompt: 'Explain transformers',
      speechLang: 'en-US',
      isOffline: false,
    }),
    ENGLISH_BUSY_FALLBACK
  );

  assert.equal(
    buildGracefulFallbackReply({
      prompt: 'লোকাল টেস্ট',
      speechLang: 'bn-BD',
      isOffline: false,
      isLocalEngine: true,
    }),
    LOCAL_SERVER_OFFLINE_FALLBACK_BN
  );

  assert.equal(
    buildGracefulFallbackReply({
      prompt: 'Local test',
      speechLang: 'en-US',
      isOffline: false,
      isLocalEngine: true,
    }),
    LOCAL_SERVER_OFFLINE_FALLBACK_EN
  );
});

test('usage monitor estimates tokens, tracks totals, rolls over daily counter, and exports JSON/Markdown', () => {
  const day1 = new Date('2026-11-20T14:00:00');
  const day2 = new Date('2026-11-21T08:00:00');

  assert.ok(estimateTokenCount('Hello Onyx AI OS') >= 4);
  assert.ok(estimateTokenCount('বাংলায় টেস্ট মেসেজ') >= 6);

  const initial = createInitialUsageStats(day1);
  const afterMsg = recordMessageUsage(initial, 30, 70, day1);
  assert.equal(afterMsg.dailyMessages, 1);
  assert.equal(afterMsg.totalInputTokens, 30);
  assert.equal(afterMsg.totalOutputTokens, 70);
  assert.equal(afterMsg.sessionInputTokens, 30);

  const nextDay = rolloverUsageIfNewDay(afterMsg, day2);
  assert.equal(nextDay.dailyMessages, 0);
  assert.equal(nextDay.totalInputTokens, 30);

  const sampleChats = [
    {
      id: 'c1',
      title: 'Test Session',
      updatedAt: 'Just now',
      mode: 'auto' as const,
      messages: [
        {
          id: 'm1',
          role: 'user' as const,
          content: 'Hi Onyx',
          timestamp: '10:00',
          mode: 'auto' as const,
          persona: 'architect' as const,
          inputMode: 'chat' as const,
        },
      ],
    },
  ];
  const json = exportChatsAsJson(sampleChats);
  assert.match(json, /"sessionCount": 1/);
  const md = exportChatsAsMarkdown(sampleChats);
  assert.match(md, /# Test Session/);
});

test('buildPollinationsImageUrl and isValidHttpUrl behave securely', () => {
  const url = buildPollinationsImageUrl('Minimalist dark watch on slate');
  assert.equal(
    url,
    'https://image.pollinations.ai/prompt/Minimalist%20dark%20watch%20on%20slate?model=flux&nologo=true'
  );
  assert.equal(isValidHttpUrl('http://127.0.0.1:8080/v1/chat/completions'), true);
  assert.equal(isValidHttpUrl('javascript:alert(1)'), false);
  assert.equal(isValidHttpUrl('not-a-url'), false);
});

test('isPreviewableCodeLanguage and buildPreviewSrcDoc work cleanly', () => {
  assert.equal(isPreviewableCodeLanguage('html'), true);
  assert.equal(isPreviewableCodeLanguage('svg'), true);
  assert.equal(isPreviewableCodeLanguage('python'), false);

  const svgDoc = buildPreviewSrcDoc('<svg viewBox="0 0 10 10"></svg>', 'svg');
  assert.match(svgDoc, /<!doctype html>/i);
  assert.equal(
    formatDownloadFilename('Dark Architectural Studio!!', 'png'),
    'dark-architectural-studio.png'
  );
});

test('getThinkingStatusLabel maps cloud, deep, task, and local modes cleanly', () => {
  assert.equal(getThinkingStatusLabel('auto', 'chat', 'cloud'), 'Thinking...');
  assert.equal(
    getThinkingStatusLabel('deep-research', 'chat', 'cloud'),
    'Searching web...'
  );
  assert.equal(
    getThinkingStatusLabel('deep-think', 'chat', 'cloud'),
    'Thinking deeply...'
  );
  assert.equal(
    getThinkingStatusLabel('auto', 'task', 'cloud'),
    'Planning tasks...'
  );
  assert.equal(
    getThinkingStatusLabel('auto', 'chat', 'local'),
    'Running local model...'
  );
});

test('isBackendEngineError and pruneCorruptedOnyxStorage protect Supabase tokens', () => {
  assert.equal(
    isBackendEngineError('Backend Engine Error: HTTP 502 Bad Gateway'),
    true
  );
  assert.equal(isBackendEngineError('Normal response'), false);

  const backing = new Map<string, string>([
    ['sb-gtzqnemrppyvnbdeoeke-auth-token', '{"access_token":"keep-me"}'],
    ['onyx_corrupt_json', '{broken'],
    ['onyx_empty', 'undefined'],
    ['onyx_valid_obj', '{"ok":true}'],
  ]);

  const fakeStorage = {
    get length() {
      return backing.size;
    },
    key(index: number) {
      return Array.from(backing.keys())[index] ?? null;
    },
    getItem(k: string) {
      return backing.get(k) ?? null;
    },
    removeItem(k: string) {
      backing.delete(k);
    },
  };

  const removed = pruneCorruptedOnyxStorage(fakeStorage);
  assert.deepEqual(removed.sort(), ['onyx_corrupt_json', 'onyx_empty']);
  assert.equal(backing.has('sb-gtzqnemrppyvnbdeoeke-auth-token'), true);
  assert.equal(backing.has('onyx_valid_obj'), true);
});

test('createBranchedMessages slices thread up through target message ID', () => {
  const list = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }];
  assert.deepEqual(
    createBranchedMessages(list, 'm2').map((m) => m.id),
    ['m1', 'm2']
  );
});
