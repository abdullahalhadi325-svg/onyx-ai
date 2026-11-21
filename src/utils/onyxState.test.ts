import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_CHATS,
  INITIAL_MEMORY_VAULTS,
  buildSimulatedAssistantMessage,
  deriveChatTitle,
  filterChats,
  filterVaults,
  getTaskCompletionStats,
  toggleTaskStepInMessages,
} from './onyxState';

test('filterChats returns all chats on empty query and filters case-insensitively', () => {
  assert.equal(filterChats(INITIAL_CHATS, '').length, INITIAL_CHATS.length);
  const telegramMatches = filterChats(INITIAL_CHATS, 'TELEGRAM');
  assert.equal(telegramMatches.length, 1);
  assert.equal(telegramMatches[0].id, 'chat-telegram-sync');
  assert.equal(filterChats(INITIAL_CHATS, 'nonexistent-query-xyz').length, 0);
});

test('filterVaults matches name and summary case-insensitively', () => {
  assert.equal(filterVaults(INITIAL_MEMORY_VAULTS, '').length, INITIAL_MEMORY_VAULTS.length);
  const fastapiMatches = filterVaults(INITIAL_MEMORY_VAULTS, 'fastapi');
  assert.equal(fastapiMatches.length, 1);
  assert.equal(fastapiMatches[0].id, 'vault-core');
});

test('deriveChatTitle truncates long prompts cleanly and handles empty input', () => {
  assert.equal(deriveChatTitle('   '), 'Untitled session');
  assert.equal(deriveChatTitle('Short title'), 'Short title');
  const longTitle = deriveChatTitle(
    'Design a complete offline-first mobile architecture with encrypted local storage'
  );
  assert.ok(longTitle.endsWith('...'));
  assert.ok(longTitle.length <= 44);
});

test('buildSimulatedAssistantMessage attaches thinking trace for deep modes and checklist for task mode', () => {
  const taskMsg = buildSimulatedAssistantMessage({
    prompt: 'Prepare quarterly architecture review',
    mode: 'deep-think',
    persona: 'architect',
    inputMode: 'task',
    tools: {
      generatePdf: true,
      createImage: false,
      attachedFileName: 'notes.md',
    },
    timestamp: '21:50',
    idSeed: 'test-1',
  });

  assert.equal(taskMsg.role, 'assistant');
  assert.ok(taskMsg.thinkingSummary);
  assert.ok(taskMsg.taskSteps && taskMsg.taskSteps.length === 4);
  assert.match(taskMsg.content, /PDF export queued for Telegram Vault/);
  assert.match(taskMsg.content, /notes\.md/);

  const flashChat = buildSimulatedAssistantMessage({
    prompt: 'Quick summary',
    mode: 'flash',
    persona: 'mentor',
    inputMode: 'chat',
    tools: {
      generatePdf: false,
      createImage: false,
      attachedFileName: null,
    },
    timestamp: '21:51',
    idSeed: 'test-2',
  });

  assert.equal(flashChat.thinkingSummary, undefined);
  assert.equal(flashChat.taskSteps, undefined);
});

test('toggleTaskStepInMessages toggles completion state and updates stats accurately', () => {
  const msg = buildSimulatedAssistantMessage({
    prompt: 'Ship step 1',
    mode: 'auto',
    persona: 'critic',
    inputMode: 'task',
    tools: { generatePdf: false, createImage: false, attachedFileName: null },
    timestamp: '21:52',
    idSeed: 'test-3',
  });

  const initialStats = getTaskCompletionStats(msg.taskSteps ?? []);
  assert.equal(initialStats.completed, 1);
  assert.equal(initialStats.total, 4);
  assert.equal(initialStats.percent, 25);

  const updated = toggleTaskStepInMessages([msg], msg.id, 'test-3-step-2');
  const nextStats = getTaskCompletionStats(updated[0].taskSteps ?? []);
  assert.equal(nextStats.completed, 2);
  assert.equal(nextStats.percent, 50);
});
