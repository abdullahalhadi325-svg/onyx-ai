import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRIENDLY_ENGINE_ERROR_MESSAGE,
  buildPollinationsImageUrl,
  buildPreviewSrcDoc,
  createBranchedMessages,
  extractErrorDiagnostic,
  extractPdfMessageId,
  formatDownloadFilename,
  getThinkingStatusLabel,
  isBackendEngineError,
  isPreviewableCodeLanguage,
  pruneCorruptedOnyxStorage,
  sanitizeAssistantErrorMessage,
} from './artifacts';

test('buildPollinationsImageUrl encodes prompt cleanly with flux model and nologo', () => {
  const url = buildPollinationsImageUrl('Minimalist dark watch on slate');
  assert.equal(
    url,
    'https://image.pollinations.ai/prompt/Minimalist%20dark%20watch%20on%20slate?model=flux&nologo=true'
  );
});

test('isPreviewableCodeLanguage returns true only for html and svg', () => {
  assert.equal(isPreviewableCodeLanguage('html'), true);
  assert.equal(isPreviewableCodeLanguage('HTML'), true);
  assert.equal(isPreviewableCodeLanguage('svg'), true);
  assert.equal(isPreviewableCodeLanguage('tsx'), false);
  assert.equal(isPreviewableCodeLanguage('python'), false);
  assert.equal(isPreviewableCodeLanguage(undefined), false);
});

test('buildPreviewSrcDoc wraps svg snippets and html fragments into standalone documents', () => {
  const svgDoc = buildPreviewSrcDoc('<svg viewBox="0 0 10 10"></svg>', 'svg');
  assert.match(svgDoc, /<!doctype html>/i);
  assert.match(svgDoc, /<svg viewBox="0 0 10 10"><\/svg>/);

  const htmlFrag = buildPreviewSrcDoc('<h1>Hello</h1>', 'html');
  assert.match(htmlFrag, /<!doctype html>/i);
  assert.match(htmlFrag, /<h1>Hello<\/h1>/);

  const fullDoc = '<!doctype html><html><body>Exact</body></html>';
  assert.equal(buildPreviewSrcDoc(fullDoc, 'html'), fullDoc);
});

test('extractPdfMessageId and formatDownloadFilename normalize metadata safely', () => {
  assert.equal(
    extractPdfMessageId({ status: 'Saved', messageId: '48291' }),
    '48291'
  );
  assert.equal(extractPdfMessageId({ status: 'Saved' }), null);
  assert.equal(
    formatDownloadFilename('Dark Architectural Studio!!', 'png'),
    'dark-architectural-studio.png'
  );
});

test('getThinkingStatusLabel maps routing and task modes cleanly', () => {
  assert.equal(getThinkingStatusLabel('auto', 'chat'), 'Onyx is routing...');
  assert.equal(
    getThinkingStatusLabel('deep-research', 'chat'),
    'Searching web...'
  );
  assert.equal(getThinkingStatusLabel('deep-think', 'chat'), 'Auditing...');
  assert.equal(getThinkingStatusLabel('auto', 'task'), 'Planning tasks...');
});

test('isBackendEngineError, extractErrorDiagnostic, and sanitizeAssistantErrorMessage work cleanly', () => {
  assert.equal(
    isBackendEngineError('Backend Engine Error: HTTP 502 Bad Gateway'),
    true
  );
  assert.equal(isBackendEngineError('  backend engine error: timeout'), true);
  assert.equal(
    isBackendEngineError('Here is your architecture summary.'),
    false
  );
  assert.equal(
    extractErrorDiagnostic('Backend Engine Error: HTTP 502 Bad Gateway'),
    'HTTP 502 Bad Gateway'
  );
  assert.equal(
    sanitizeAssistantErrorMessage('Backend Engine Error: 503'),
    FRIENDLY_ENGINE_ERROR_MESSAGE
  );
});

test('pruneCorruptedOnyxStorage removes only broken onyx_* entries and preserves sb-* auth', () => {
  const backing = new Map<string, string>([
    ['sb-gtzqnemrppyvnbdeoeke-auth-token', '{"access_token":"keep-me"}'],
    ['onyx_corrupt_json', '{broken'],
    ['onyx_empty', 'undefined'],
    ['onyx_valid_obj', '{"autoAttachPdf":false}'],
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
  assert.equal(createBranchedMessages(list, 'missing').length, 4);
});
