import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUEST_TIMEOUT_MS,
  buildChatRequestPayload,
  mapRoutingModeToApiMode,
  normalizeBackendResponse,
} from './api';
import { BACKEND_API_URL } from './config';
import {
  deriveUserProfile,
  groupActiveChatRowsIntoSessions,
} from './supabase';

test('BACKEND_API_URL targets Cloudflare Worker with no trailing slash and 25s timeout', () => {
  assert.equal(
    BACKEND_API_URL,
    'https://hadi-mp-ai-backend.abdullahalhadi325.workers.dev'
  );
  assert.equal(BACKEND_API_URL.endsWith('/'), false);
  assert.equal(REQUEST_TIMEOUT_MS, 25000);
});

test('mapRoutingModeToApiMode maps all routing modes and task mode accurately', () => {
  assert.equal(mapRoutingModeToApiMode('auto', 'chat'), 'flash');
  assert.equal(mapRoutingModeToApiMode('flash', 'chat'), 'flash');
  assert.equal(mapRoutingModeToApiMode('deep-research', 'chat'), 'research');
  assert.equal(mapRoutingModeToApiMode('deep-think', 'chat'), 'deep_think');
  assert.equal(mapRoutingModeToApiMode('auto', 'task'), 'task');
  assert.equal(mapRoutingModeToApiMode('deep-think', 'task'), 'task');
});

test('buildChatRequestPayload matches exact Cloudflare Worker JSON contract', () => {
  const payload = buildChatRequestPayload({
    userId: 'user-123',
    message: 'Draft architecture spec',
    routingMode: 'deep-research',
    inputMode: 'chat',
    persona: 'investigator',
    generatePdf: true,
  });

  assert.deepEqual(payload, {
    message: 'Draft architecture spec',
    mode: 'research',
    persona: 'investigator',
    user_id: 'user-123',
    generate_pdf: true,
  });

  const guestPayload = buildChatRequestPayload({
    userId: null,
    message: 'Hello Onyx',
    routingMode: 'auto',
    inputMode: 'task',
    persona: 'architect',
    generatePdf: false,
  });

  assert.equal(guestPayload.user_id, null);
  assert.equal(guestPayload.mode, 'task');
});

test('normalizeBackendResponse parses answer, provider, error, thinking_log, media_cards, sources, and pdf_vault safely', () => {
  const parsed = normalizeBackendResponse({
    answer: 'Systems synthesis ready.',
    provider: 'gemini',
    thinking_log: 'Checked storage latency and offline boundaries.',
    media_cards: [
      { title: 'Architecture diagram', image_url: 'https://example.com/a.png' },
    ],
    sources: [
      { title: 'Supabase Docs', url: 'https://supabase.com/docs' },
    ],
    pdf_vault: {
      status: 'Delivered',
      filename: 'Onyx_Brief.pdf',
      url: 'https://example.com/brief.pdf',
    },
  });

  assert.equal(parsed.answer, 'Systems synthesis ready.');
  assert.equal(parsed.provider, 'gemini');
  assert.equal(
    parsed.thinking_log,
    'Checked storage latency and offline boundaries.'
  );
  assert.equal(parsed.media_cards.length, 1);
  assert.equal(parsed.media_cards[0].imageUrl, 'https://example.com/a.png');
  assert.equal(parsed.sources.length, 1);
  assert.equal(parsed.sources[0].title, 'Supabase Docs');
  assert.equal(parsed.pdf_vault?.filename, 'Onyx_Brief.pdf');

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
