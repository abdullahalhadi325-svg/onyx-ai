import test from 'node:test';
import assert from 'node:assert/strict';
import localModelsRaw from '../data/localModels.json';
import type { ChatMessage, ChatSession, LocalModelEntry } from '../types/onyx';
import {
  RESPONSE_TONES,
  deriveChatTitle,
  filterChats,
  getTaskCompletionStats,
  toggleTaskStepInMessages,
} from './onyxState';

const SAMPLE_SESSIONS: ChatSession[] = [
  {
    id: 's1',
    title: 'Local Qwen GGUF setup',
    updatedAt: 'Just now',
    mode: 'auto',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'How to launch llama-server in Termux?',
        timestamp: '10:00',
        mode: 'auto',
        persona: 'architect',
        inputMode: 'chat',
      },
    ],
  },
  {
    id: 's2',
    title: 'Android WebView optimization',
    updatedAt: '5m ago',
    mode: 'flash',
    messages: [
      {
        id: 'm2',
        role: 'user',
        content: 'Keep animations at 60fps on mobile GPUs',
        timestamp: '09:55',
        mode: 'flash',
        persona: 'mentor',
        inputMode: 'chat',
      },
    ],
  },
];

test('filterChats returns all chats on empty query and filters case-insensitively', () => {
  assert.equal(filterChats(SAMPLE_SESSIONS, '').length, 2);
  const termuxMatches = filterChats(SAMPLE_SESSIONS, 'TERMUX');
  assert.equal(termuxMatches.length, 1);
  assert.equal(termuxMatches[0].id, 's1');
  assert.equal(filterChats(SAMPLE_SESSIONS, 'nonexistent-xyz').length, 0);
});

test('deriveChatTitle truncates long prompts cleanly and handles empty input', () => {
  assert.equal(deriveChatTitle('   '), 'New conversation');
  assert.equal(deriveChatTitle('Short title'), 'Short title');
  const longTitle = deriveChatTitle(
    'Design a complete offline-first mobile architecture with encrypted local storage'
  );
  assert.ok(longTitle.endsWith('...'));
  assert.ok(longTitle.length <= 44);
});

test('toggleTaskStepInMessages toggles completion state and updates stats accurately', () => {
  const msg: ChatMessage = {
    id: 'task-msg-1',
    role: 'assistant',
    content: 'Checklist ready',
    timestamp: '21:52',
    mode: 'auto',
    persona: 'critic',
    inputMode: 'task',
    taskSteps: [
      { id: 'step-1', label: 'Install Termux', detail: 'From F-Droid', done: true },
      { id: 'step-2', label: 'Build llama.cpp', detail: 'Enable NEON', done: false },
    ],
  };

  const initialStats = getTaskCompletionStats(msg.taskSteps ?? []);
  assert.equal(initialStats.completed, 1);
  assert.equal(initialStats.total, 2);
  assert.equal(initialStats.percent, 50);

  const updated = toggleTaskStepInMessages([msg], msg.id, 'step-2');
  const nextStats = getTaskCompletionStats(updated[0].taskSteps ?? []);
  assert.equal(nextStats.completed, 2);
  assert.equal(nextStats.percent, 100);
});

test('localModels.json contains curated 8GB-RAM-friendly Q4_K_M GGUF catalog with Hugging Face URLs', () => {
  const models = localModelsRaw as LocalModelEntry[];
  assert.ok(models.length >= 4);
  assert.ok(models.some((m) => m.category === 'uncensored'));
  assert.ok(models.some((m) => m.category === 'general'));
  for (const model of models) {
    assert.ok(model.huggingfaceUrl.startsWith('https://huggingface.co/'));
    assert.equal(model.quantization, 'Q4_K_M');
  }
  assert.equal(RESPONSE_TONES.length, 4);
});
