import type { ChatSession, UsageStats } from '../types/onyx';

export function getTodayDateKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createInitialUsageStats(now: Date = new Date()): UsageStats {
  return {
    dateKey: getTodayDateKey(now),
    dailyMessages: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    sessionInputTokens: 0,
    sessionOutputTokens: 0,
  };
}

export function rolloverUsageIfNewDay(
  stats: UsageStats,
  now: Date = new Date()
): UsageStats {
  const today = getTodayDateKey(now);
  if (stats.dateKey === today) {
    return stats;
  }
  return {
    ...stats,
    dateKey: today,
    dailyMessages: 0,
  };
}

/**
 * Fast client-side token approximation (~4 chars/token for Latin, ~2 chars/token for Bengali).
 */
export function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  const bengaliMatches = trimmed.match(/[\u0980-\u09FF]/g);
  const bengaliCount = bengaliMatches ? bengaliMatches.length : 0;
  const otherCount = Math.max(0, trimmed.length - bengaliCount);
  return Math.max(1, Math.ceil(otherCount / 4 + bengaliCount / 2));
}

export function recordMessageUsage(
  prev: UsageStats,
  inputTokens: number,
  outputTokens: number,
  now: Date = new Date()
): UsageStats {
  const base = rolloverUsageIfNewDay(prev, now);
  return {
    dateKey: base.dateKey,
    dailyMessages: base.dailyMessages + 1,
    totalInputTokens: base.totalInputTokens + Math.max(0, inputTokens),
    totalOutputTokens: base.totalOutputTokens + Math.max(0, outputTokens),
    sessionInputTokens: base.sessionInputTokens + Math.max(0, inputTokens),
    sessionOutputTokens: base.sessionOutputTokens + Math.max(0, outputTokens),
  };
}

export function formatResetCountdown(now: Date = new Date()): string {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const diffMs = Math.max(0, nextMidnight.getTime() - now.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function exportChatsAsJson(chats: ChatSession[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'Onyx AI OS',
      sessionCount: chats.length,
      sessions: chats,
    },
    null,
    2
  );
}

export function exportChatsAsMarkdown(chats: ChatSession[]): string {
  if (chats.length === 0) {
    return '# Onyx AI OS Chat Export\n\nNo conversations recorded yet.\n';
  }

  return chats
    .map((chat) => {
      const header = `# ${chat.title}\n_Updated: ${chat.updatedAt}_\n`;
      const body = chat.messages
        .map((msg) => {
          const speaker = msg.role === 'user' ? 'User' : 'Onyx';
          return `### ${speaker} (${msg.timestamp || 'time n/a'})\n\n${msg.content}\n`;
        })
        .join('\n');
      return `${header}\n${body}`;
    })
    .join('\n---\n\n');
}

export function triggerTextFileDownload(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
