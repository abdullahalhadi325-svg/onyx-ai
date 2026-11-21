import type {
  ChatMessage,
  ChatSession,
  PersonaId,
  PersonaOption,
  ResponseTone,
  RoutingModeId,
  RoutingModeOption,
  TaskStep,
} from '../types/onyx';

export const ROUTING_MODES: RoutingModeOption[] = [
  {
    id: 'auto',
    label: 'Onyx Auto',
    shortLabel: 'Auto',
    description: 'Smart Routing',
  },
  {
    id: 'flash',
    label: 'Onyx Flash',
    shortLabel: 'Flash',
    description: 'Everyday Speed',
  },
  {
    id: 'deep-research',
    label: 'Onyx Deep Research',
    shortLabel: 'Deep Research',
    description: 'Live Web & Visuals',
  },
  {
    id: 'deep-think',
    label: 'Onyx Deep Think',
    shortLabel: 'Deep Think',
    description: 'Multi-Agent Verification',
  },
];

export const PERSONAS: PersonaOption[] = [
  {
    id: 'architect',
    name: 'Architect',
    description: 'Systems structure and first-principles plans',
  },
  {
    id: 'investigator',
    name: 'Investigator',
    description: 'Source verification and deep evidence trails',
  },
  {
    id: 'mentor',
    name: 'Mentor',
    description: 'Clear walkthroughs and calm step-by-step guidance',
  },
  {
    id: 'critic',
    name: 'Critic',
    description: 'Stress-testing assumptions and blind spots',
  },
];

export const RESPONSE_TONES: Array<{
  id: ResponseTone;
  label: string;
  hint: string;
}> = [
  { id: 'direct', label: 'Direct', hint: 'Zero filler, immediate answers' },
  { id: 'balanced', label: 'Balanced', hint: 'Clear and conversational' },
  { id: 'concise', label: 'Concise', hint: 'Short bullet-first replies' },
  { id: 'detailed', label: 'Detailed', hint: 'Thorough deep-dive context' },
];

export function getRoutingModeOption(id: RoutingModeId): RoutingModeOption {
  return ROUTING_MODES.find((m) => m.id === id) ?? ROUTING_MODES[0];
}

export function getPersonaOption(id: PersonaId): PersonaOption {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}

export function filterChats(chats: ChatSession[], query: string): ChatSession[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return chats;
  }
  return chats.filter(
    (chat) =>
      chat.title.toLowerCase().includes(normalized) ||
      chat.messages.some((m) => m.content.toLowerCase().includes(normalized))
  );
}

export function deriveChatTitle(prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return 'New conversation';
  }
  if (cleaned.length <= 44) {
    return cleaned;
  }
  return `${cleaned.slice(0, 41).trimEnd()}...`;
}

export function getTaskCompletionStats(steps: TaskStep[]): {
  completed: number;
  total: number;
  percent: number;
} {
  const total = steps.length;
  if (total === 0) {
    return { completed: 0, total: 0, percent: 0 };
  }
  const completed = steps.filter((s) => s.done).length;
  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
  };
}

export function toggleTaskStepInMessages(
  messages: ChatMessage[],
  messageId: string,
  stepId: string
): ChatMessage[] {
  return messages.map((msg) => {
    if (msg.id !== messageId || !msg.taskSteps) {
      return msg;
    }
    return {
      ...msg,
      taskSteps: msg.taskSteps.map((step) =>
        step.id === stepId ? { ...step, done: !step.done } : step
      ),
    };
  });
}

export function formatCurrentTime(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
