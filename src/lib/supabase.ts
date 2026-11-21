import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { normalizeMediaCards } from './api';
import { deriveChatTitle, formatCurrentTime } from '../utils/onyxState';
import type {
  ChatMessage,
  ChatSession,
  MediaCard,
  OnyxUserProfile,
} from '../types/onyx';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface ActiveChatRow {
  id?: string | number;
  user_id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking_log?: string | null;
  media_cards?: unknown;
  created_at?: string;
}

export function deriveUserProfile(
  user: { id: string; email?: string | null } | null,
  isGuest: boolean
): OnyxUserProfile {
  if (!user || isGuest) {
    return {
      id: null,
      email: null,
      displayName: 'Guest (Local)',
      initials: 'GL',
      isGuest: true,
    };
  }

  const email = user.email ?? null;
  const localPart = email ? email.split('@')[0] : 'Onyx User';
  const parts = localPart
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const displayName =
    parts.length > 0
      ? parts
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      : 'Onyx User';

  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : displayName.slice(0, 2).toUpperCase();

  return {
    id: user.id,
    email,
    displayName,
    initials,
    isGuest: false,
  };
}

function formatSessionUpdatedLabel(iso?: string): string {
  if (!iso) {
    return 'Recent';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Recent';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) {
    return 'Just now';
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function groupActiveChatRowsIntoSessions(
  rows: ActiveChatRow[]
): ChatSession[] {
  const grouped = new Map<
    string,
    { messages: ChatMessage[]; lastTimestampMs: number; lastIso?: string }
  >();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.session_id || !row.content) {
      continue;
    }

    const rowDate = row.created_at ? new Date(row.created_at) : null;
    const timestampMs =
      rowDate && !Number.isNaN(rowDate.getTime()) ? rowDate.getTime() : index;

    const msg: ChatMessage = {
      id: row.id ? String(row.id) : `${row.session_id}-${index}`,
      role: row.role === 'assistant' ? 'assistant' : 'user',
      content: row.content,
      timestamp:
        rowDate && !Number.isNaN(rowDate.getTime())
          ? formatCurrentTime(rowDate)
          : '',
      mode: 'auto',
      persona: 'architect',
      inputMode: 'chat',
      thinkingSummary:
        typeof row.thinking_log === 'string' && row.thinking_log.trim()
          ? row.thinking_log.trim()
          : undefined,
      mediaCards: normalizeMediaCards(row.media_cards),
    };

    const existing = grouped.get(row.session_id);
    if (existing) {
      existing.messages.push(msg);
      if (timestampMs >= existing.lastTimestampMs) {
        existing.lastTimestampMs = timestampMs;
        existing.lastIso = row.created_at;
      }
    } else {
      grouped.set(row.session_id, {
        messages: [msg],
        lastTimestampMs: timestampMs,
        lastIso: row.created_at,
      });
    }
  }

  return Array.from(grouped.entries())
    .sort((a, b) => b[1].lastTimestampMs - a[1].lastTimestampMs)
    .map(([sessionId, entry]) => {
      const firstUserMessage = entry.messages.find((m) => m.role === 'user');
      return {
        id: sessionId,
        title: deriveChatTitle(
          firstUserMessage?.content ?? entry.messages[0]?.content ?? 'Session'
        ),
        updatedAt: formatSessionUpdatedLabel(entry.lastIso),
        mode: 'auto',
        messages: entry.messages,
      };
    });
}

export async function fetchUserChats(userId: string): Promise<{
  sessions: ChatSession[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('active_chats')
    .select('id, user_id, session_id, role, content, thinking_log, media_cards, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    return { sessions: [], error: error.message };
  }

  const rows = (data ?? []) as ActiveChatRow[];
  return {
    sessions: groupActiveChatRowsIntoSessions(rows),
    error: null,
  };
}

export async function saveActiveChatMessage(params: {
  userId: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  thinkingLog?: string | null;
  mediaCards?: MediaCard[];
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('active_chats').insert({
    user_id: params.userId,
    session_id: params.sessionId,
    role: params.role,
    content: params.content,
    thinking_log: params.thinkingLog ?? null,
    media_cards:
      params.mediaCards && params.mediaCards.length > 0
        ? params.mediaCards
        : null,
  });

  return { error: error ? error.message : null };
}

export async function fetchUserCoreContext(userId: string): Promise<{
  coreContext: string | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('user_core_profile')
    .select('core_context')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { coreContext: null, error: error.message };
  }

  const row = data as { core_context?: string | null } | null;
  return {
    coreContext: typeof row?.core_context === 'string' ? row.core_context : null,
    error: null,
  };
}

export async function upsertUserCoreContext(
  userId: string,
  coreContext: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('user_core_profile').upsert(
    {
      user_id: userId,
      core_context: coreContext,
    },
    { onConflict: 'user_id' }
  );

  return { error: error ? error.message : null };
}
