import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BENGALI_SYSTEM_INSTRUCTION,
  MAX_CONVERSATION_HISTORY_MESSAGES,
  MAX_SILENT_FAILOVER_ATTEMPTS,
  REQUEST_TIMEOUT_MS,
  buildChatRequestPayload,
  getEnabledProviderList,
  mapRoutingModeToApiMode,
  normalizeBackendResponse,
} from './api';
import {
  DEFAULT_ADMIN_CONFIG,
  hashAdminPin,
  isAdminEmail,
  mergeAdminConfig,
} from './adminConfig';
import { BACKEND_API_URL, DEVELOPER_LINKS } from './config';
import {
  deriveUserProfile,
  groupActiveChatRowsIntoSessions,
} from './supabase';

test('BACKEND_API_URL targets Cloudflare Worker with 45s timeout, 3 failovers, and 16-message memory window', () => {
  assert.equal(
    BACKEND_API_URL,
    'https://hadi-mp-ai-backend.abdullahalhadi325.workers.dev'
  );
  assert.equal(BACKEND_API_URL.endsWith('/'), false);
  assert.equal(REQUEST_TIMEOUT_MS, 45000);
  assert.equal(MAX_SILENT_FAILOVER_ATTEMPTS, 3);
  assert.equal(MAX_CONVERSATION_HISTORY_MESSAGES, 16);
});

test('DEVELOPER_LINKS exposes updated Portfolio, Telegram @abdullahalhadis, and WhatsApp +8801723257754', () => {
  assert.equal(
    DEVELOPER_LINKS.portfolio,
    'https://mr-onion-dev-portfolio-ud2z.vercel.app'
  );
  assert.equal(DEVELOPER_LINKS.telegramHandle, '@abdullahalhadis');
  assert.equal(DEVELOPER_LINKS.telegramUrl, 'https://t.me/abdullahalhadis');
  assert.equal(DEVELOPER_LINKS.whatsappNumber, '+8801723257754');
  assert.equal(DEVELOPER_LINKS.whatsappUrl, 'https://wa.me/8801723257754');
});

test('mapRoutingModeToApiMode maps all routing modes and task mode accurately', () => {
  assert.equal(mapRoutingModeToApiMode('auto', 'chat'), 'flash');
  assert.equal(mapRoutingModeToApiMode('flash', 'chat'), 'flash');
  assert.equal(mapRoutingModeToApiMode('deep-research', 'chat'), 'research');
  assert.equal(mapRoutingModeToApiMode('deep-think', 'chat'), 'deep_think');
  assert.equal(mapRoutingModeToApiMode('auto', 'task'), 'task');
  assert.equal(mapRoutingModeToApiMode('deep-think', 'task'), 'task');
});

test('buildChatRequestPayload builds standard chat payload, preserves last 16 history messages, and forces Gemini Vision when image is attached', () => {
  const longHistory = Array.from({ length: 20 }, (_, idx) => ({
    role: (idx % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `Turn ${idx + 1}`,
  }));

  const standard = buildChatRequestPayload({
    userId: 'user-123',
    message: 'What was my earlier turn?',
    history: longHistory,
    routingMode: 'deep-research',
    inputMode: 'chat',
    persona: 'investigator',
    tone: 'concise',
  });

  assert.equal(standard.mode, 'research');
  assert.equal(standard.persona, 'investigator');
  assert.equal(standard.tone, 'concise');
  assert.equal(standard.user_id, 'user-123');
  assert.equal(standard.language, 'en');
  assert.equal(standard.vision, undefined);
  assert.equal(standard.force_provider, undefined);
  // Last 16 prior turns in history + current user prompt in messages (17 total)
  assert.equal(standard.history.length, 16);
  assert.equal(standard.history[0].content, 'Turn 5');
  assert.equal(standard.messages.length, 17);
  assert.equal(standard.messages[0].content, 'Turn 5');
  assert.equal(
    standard.messages[standard.messages.length - 1].content,
    'What was my earlier turn?'
  );
  assert.equal(
    standard.messages[standard.messages.length - 1].role,
    'user'
  );

  const vision = buildChatRequestPayload({
    userId: null,
    message: 'Describe this circuit diagram',
    routingMode: 'auto',
    inputMode: 'chat',
    persona: 'architect',
    attachedImage: {
      fileName: 'board.png',
      mimeType: 'image/png',
      base64Data: 'iVBORw0KGgoAAAANSUhEUg==',
      previewUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    },
  });

  assert.equal(vision.force_provider, 'gemini');
  assert.equal(vision.vision, true);
  assert.deepEqual(vision.preferred_providers, ['gemini']);
  assert.equal(vision.image_mime_type, 'image/png');
  assert.equal(vision.image_base64, 'iVBORw0KGgoAAAANSUhEUg==');
  assert.equal(vision.attachments?.length, 1);
  assert.equal(vision.attachments?.[0].mimeType, 'image/png');
});

test('buildChatRequestPayload detects Bengali script in prompt or history and routes to Gemini with Bengali purity instruction', () => {
  const directBengali = buildChatRequestPayload({
    userId: null,
    message: 'বাংলায় বাংলাদেশের ইতিহাস সংক্ষেপে বলো',
    history: [],
    routingMode: 'auto',
    inputMode: 'chat',
    persona: 'architect',
  });

  assert.equal(directBengali.language, 'bn');
  assert.equal(directBengali.force_provider, 'gemini');
  assert.deepEqual(directBengali.preferred_providers, ['gemini']);
  assert.ok(
    directBengali.system_prompt?.includes(BENGALI_SYSTEM_INSTRUCTION)
  );

  const bengaliFromHistory = buildChatRequestPayload({
    userId: null,
    message: 'Continue please',
    history: [
      { role: 'user', content: 'আমার নাম হাদি' },
      { role: 'assistant', content: 'নমস্কার হাদি! বলুন কীভাবে সাহায্য করতে পারি?' },
    ],
    routingMode: 'flash',
    inputMode: 'chat',
    persona: 'mentor',
  });

  assert.equal(bengaliFromHistory.language, 'bn');
  assert.equal(bengaliFromHistory.force_provider, 'gemini');
  assert.deepEqual(bengaliFromHistory.preferred_providers, ['gemini']);
  assert.equal(bengaliFromHistory.messages.length, 3);
  assert.ok(
    bengaliFromHistory.system_prompt?.includes(BENGALI_SYSTEM_INSTRUCTION)
  );
});

test('getEnabledProviderList respects AdminConfig provider toggles', () => {
  const custom = mergeAdminConfig({
    enabledProviders: {
      gemini: true,
      groq: false,
      openrouter: true,
      cloudflare: false,
    },
  });
  assert.deepEqual(getEnabledProviderList(custom), ['gemini', 'openrouter']);
});

test('AdminConfig helpers verify admin email, sanitize limits, and hash PIN deterministically', async () => {
  assert.equal(isAdminEmail('abdullahalhadi325@gmail.com'), true);
  assert.equal(isAdminEmail('ABDULLAHALHADI325@GMAIL.COM'), true);
  assert.equal(isAdminEmail('other@example.com'), false);
  assert.equal(isAdminEmail(null), false);

  const sanitized = mergeAdminConfig({ dailyMessageLimit: 2 });
  assert.equal(
    sanitized.dailyMessageLimit,
    DEFAULT_ADMIN_CONFIG.dailyMessageLimit
  );

  const hashA = await hashAdminPin('4829');
  const hashB = await hashAdminPin('4829');
  const hashC = await hashAdminPin('9999');
  assert.equal(hashA, hashB);
  assert.notEqual(hashA, hashC);
  assert.ok(hashA.length >= 16);
});

test('normalizeBackendResponse parses answer, provider, usage, thinking_log, media_cards, and sources safely', () => {
  const parsed = normalizeBackendResponse({
    answer: 'Systems synthesis ready.',
    provider: 'gemini',
    thinking_log: 'Checked storage latency and offline boundaries.',
    media_cards: [
      { title: 'Architecture diagram', image_url: 'https://example.com/a.png' },
    ],
    sources: [{ title: 'Supabase Docs', url: 'https://supabase.com/docs' }],
    usage: { prompt_tokens: 42, completion_tokens: 118 },
  });

  assert.equal(parsed.answer, 'Systems synthesis ready.');
  assert.equal(parsed.provider, 'gemini');
  assert.equal(parsed.media_cards.length, 1);
  assert.equal(parsed.sources.length, 1);
  assert.equal(parsed.usage?.inputTokens, 42);
  assert.equal(parsed.usage?.outputTokens, 118);

  const providerErr = normalizeBackendResponse({
    provider: 'error',
    error: 'Upstream model rate-limited',
  });
  assert.equal(providerErr.provider, 'error');
  assert.equal(providerErr.error, 'Upstream model rate-limited');
});

test('groupActiveChatRowsIntoSessions groups rows by session_id and sorts newest first', () => {
  const sessions = groupActiveChatRowsIntoSessions([
    {
      id: 1,
      user_id: 'u1',
      session_id: 's1',
      role: 'user',
      content: 'First session question',
      created_at: '2026-11-18T10:00:00.000Z',
    },
    {
      id: 2,
      user_id: 'u1',
      session_id: 's1',
      role: 'assistant',
      content: 'First session answer',
      thinking_log: 'Reasoning note',
      created_at: '2026-11-18T10:00:05.000Z',
    },
    {
      id: 3,
      user_id: 'u1',
      session_id: 's2',
      role: 'user',
      content: 'Newer session question',
      created_at: '2026-11-19T12:00:00.000Z',
    },
  ]);

  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].id, 's2');
  assert.equal(sessions[1].id, 's1');
  assert.equal(sessions[1].messages.length, 2);
  assert.equal(sessions[1].messages[1].thinkingSummary, 'Reasoning note');
});

test('deriveUserProfile builds clean initials for authenticated user and Guest fallback', () => {
  const authed = deriveUserProfile(
    { id: 'u1', email: 'abdullah.hadi@example.com' },
    false
  );
  assert.equal(authed.initials, 'AH');
  assert.equal(authed.displayName, 'Abdullah Hadi');
  assert.equal(authed.isGuest, false);

  const guest = deriveUserProfile(null, true);
  assert.equal(guest.initials, 'GL');
  assert.equal(guest.isGuest, true);
});
