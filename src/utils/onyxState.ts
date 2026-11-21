import type {
  ActiveTools,
  ChatMessage,
  ChatSession,
  InputMode,
  MediaAsset,
  MemoryVault,
  PersonaId,
  PersonaOption,
  RoutingModeId,
  RoutingModeOption,
  StarterPrompt,
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

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: 'starter-1',
    iconName: 'compass',
    text: 'Audit my weekly calendar and draft a focused deep-work plan',
    suggestedInputMode: 'task',
  },
  {
    id: 'starter-2',
    iconName: 'stack',
    text: 'Compare offline-first local storage engines for a mobile app',
    suggestedInputMode: 'chat',
  },
  {
    id: 'starter-3',
    iconName: 'terminal',
    text: 'Turn my rough architecture notes into an executive PDF brief',
    suggestedInputMode: 'chat',
  },
];

export const INITIAL_MEMORY_VAULTS: MemoryVault[] = [
  {
    id: 'vault-core',
    name: 'Core Engineering Specs',
    itemCount: 18,
    updatedAt: 'Today, 09:40',
    summary: 'Capacitor Android targets, FastAPI contracts, and strict design tokens.',
    seedPrompt: 'Summarize the latest architecture constraints stored in Core Engineering Specs.',
  },
  {
    id: 'vault-reading',
    name: 'Research & Briefings',
    itemCount: 11,
    updatedAt: 'Yesterday',
    summary: 'Synthesized papers, competitor teardowns, and Telegram PDF exports.',
    seedPrompt: 'Pull the top three takeaways from Research & Briefings.',
  },
  {
    id: 'vault-personal',
    name: 'Personal Operating Rhythm',
    itemCount: 7,
    updatedAt: 'Nov 16',
    summary: 'Deep-work windows, travel checklists, and weekly review templates.',
    seedPrompt: 'Build a Friday review checklist using my Personal Operating Rhythm vault.',
  },
];

export const INITIAL_MEDIA_ASSETS: MediaAsset[] = [
  {
    id: 'media-1',
    title: 'Onyx_Mobile_Architecture_Brief.pdf',
    kind: 'PDF',
    size: '1.4 MB',
    createdAt: 'Today, 18:12',
    destination: 'Telegram Vault',
  },
  {
    id: 'media-2',
    title: 'System_Topology_Wireframe.png',
    kind: 'Image',
    size: '840 KB',
    createdAt: 'Yesterday',
    destination: 'Media Library',
  },
  {
    id: 'media-3',
    title: 'Q4_Deep_Research_Digest.pdf',
    kind: 'PDF',
    size: '2.1 MB',
    createdAt: 'Nov 15',
    destination: 'Telegram Vault',
  },
  {
    id: 'media-4',
    title: 'FastAPI_Streaming_Notes.md',
    kind: 'Document',
    size: '34 KB',
    createdAt: 'Nov 12',
    destination: 'Core Specs',
  },
];

export const INITIAL_CHATS: ChatSession[] = [
  {
    id: 'chat-mobile-shell',
    title: 'Mobile navigation ergonomics audit',
    updatedAt: '2h ago',
    mode: 'deep-think',
    messages: [
      {
        id: 'msg-seed-1',
        role: 'user',
        content: 'Review thumb-zone ergonomics for a 390px mobile AI workspace.',
        timestamp: '19:14',
        mode: 'deep-think',
        persona: 'architect',
        inputMode: 'chat',
      },
      {
        id: 'msg-seed-2',
        role: 'assistant',
        content: `### Thumb-Zone Blueprint for 390px Mobile

Anchor primary capture and mode switching inside the lower **40% thumb arc**, keep the floating top bar compact, and preserve \`44px\` minimum touch targets across every interactive surface.

| Zone | Screen Band | Primary Surface | Target Height |
| --- | --- | --- | --- |
| Header | Top 12% | \`#181818/80\` floating bar | \`44px\` controls |
| Stream | Middle 58% | \`#000000\` flat canvas | Fluid scroll |
| Dock | Bottom 30% | \`#1F1F1F\` input pill | \`44px\` buttons |

Here is a live previewable **SVG wire-zone diagram** for the 390px layout:

\`\`\`svg
<svg viewBox="0 0 240 360" width="240" height="360" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="216" height="336" rx="28" fill="#000000" stroke="#313131" stroke-width="2"/>
  <rect x="28" y="28" width="184" height="34" rx="12" fill="#181818" stroke="#313131"/>
  <text x="120" y="49" fill="#ffffff" font-size="11" font-family="monospace" text-anchor="middle">Onyx Floating Bar</text>
  <rect x="28" y="80" width="184" height="176" rx="16" fill="#131209" stroke="#272727"/>
  <text x="120" y="172" fill="#9B9B9B" font-size="11" font-family="sans-serif" text-anchor="middle">Fluid Thread Canvas</text>
  <rect x="28" y="274" width="184" height="54" rx="20" fill="#1F1F1F" stroke="#313131"/>
  <text x="120" y="305" fill="#ffffff" font-size="11" font-family="monospace" text-anchor="middle">Thumb Input Dock</text>
</svg>
\`\`\`

- Zero single-sided card borders across every overlay.
- Nested radius math ensures crisp alignment between outer containers and inner buttons.`,
        timestamp: '19:14',
        mode: 'deep-think',
        persona: 'architect',
        inputMode: 'chat',
        thinkingSummary:
          '[Agent 1 · Layout] Evaluated 390px viewport reach arcs and verified 44px minimum target sizing.\n[Agent 2 · Audit] Confirmed zero horizontal overflow for GFM tables and preformatted code blocks.',
        thinkingDuration: '1.8s',
        sources: [
          {
            title: 'W3C Target Size Accessibility',
            url: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
          },
          {
            title: 'Capacitor Mobile Viewport Guide',
            url: 'https://capacitorjs.com/docs/guides/screen-orientation',
          },
        ],
        pdfVault: {
          status: 'PDF Saved to Telegram Vault',
          filename: 'Onyx_Mobile_Ergonomics.pdf',
          messageId: '48291',
        },
      },
    ],
  },
  {
    id: 'chat-telegram-sync',
    title: 'Telegram PDF vault export schema',
    updatedAt: 'Yesterday',
    mode: 'auto',
    messages: [
      {
        id: 'msg-seed-3',
        role: 'user',
        content: 'Outline the payload fields for delivering generated PDF briefs to Telegram.',
        timestamp: '16:40',
        mode: 'auto',
        persona: 'investigator',
        inputMode: 'task',
      },
      {
        id: 'msg-seed-4',
        role: 'assistant',
        content: 'Prepared an autonomous execution checklist for the Telegram PDF delivery flow:',
        timestamp: '16:40',
        mode: 'auto',
        persona: 'investigator',
        inputMode: 'task',
        taskSteps: [
          {
            id: 'seed-step-1',
            label: 'Compile structured markdown brief with section anchors',
            detail: 'Format executive summary, evidence blocks, and monospace metadata',
            done: true,
          },
          {
            id: 'seed-step-2',
            label: 'Render print-ready PDF using Geist typography tokens',
            detail: 'Embed clean margins and zero-overflow tables',
            done: true,
          },
          {
            id: 'seed-step-3',
            label: 'Dispatch document to paired Telegram vault channel',
            detail: 'Attach caption summary and sync vault index record',
            done: false,
          },
        ],
      },
    ],
  },
  {
    id: 'chat-offline-sync',
    title: 'Local-first state cache tradeoffs',
    updatedAt: 'Nov 17',
    mode: 'deep-research',
    messages: [
      {
        id: 'msg-seed-5',
        role: 'user',
        content: 'Compare IndexedDB and Capacitor SQLite for instant chat history hydration.',
        timestamp: '11:05',
        mode: 'deep-research',
        persona: 'critic',
        inputMode: 'chat',
      },
      {
        id: 'msg-seed-6',
        role: 'assistant',
        content:
          'IndexedDB gives zero-bridge startup inside web views, while Capacitor SQLite prevents OS storage eviction on Android and supports full-text search across thousands of vault notes. For hybrid web and Android APK builds, pair an in-memory store with a pluggable persistence adapter.',
        timestamp: '11:05',
        mode: 'deep-research',
        persona: 'critic',
        inputMode: 'chat',
        thinkingSummary:
          'Cross-checked Android WebView eviction policies, cold-start hydration latency, and FTS5 query ergonomics.',
        thinkingDuration: '2.4s',
      },
    ],
  },
];

export const DEFAULT_PERSONAL_INTELLIGENCE =
  'Building Onyx, a mobile-first Personal AI OS. Prefer concise, high-signal technical answers, flat dark interfaces, strict architectural clarity, and actionable checklists.';

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

export function filterVaults(vaults: MemoryVault[], query: string): MemoryVault[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return vaults;
  }
  return vaults.filter(
    (vault) =>
      vault.name.toLowerCase().includes(normalized) ||
      vault.summary.toLowerCase().includes(normalized)
  );
}

export function filterMediaAssets(assets: MediaAsset[], query: string): MediaAsset[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return assets;
  }
  return assets.filter(
    (asset) =>
      asset.title.toLowerCase().includes(normalized) ||
      asset.kind.toLowerCase().includes(normalized) ||
      asset.destination.toLowerCase().includes(normalized)
  );
}

export function deriveChatTitle(prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return 'Untitled session';
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

export function buildSimulatedAssistantMessage(params: {
  prompt: string;
  mode: RoutingModeId;
  persona: PersonaId;
  inputMode: InputMode;
  tools: ActiveTools;
  timestamp: string;
  idSeed: string;
}): ChatMessage {
  const { prompt, mode, persona, inputMode, tools, timestamp, idSeed } = params;
  const modeInfo = getRoutingModeOption(mode);
  const personaInfo = getPersonaOption(persona);

  const toolNotes: string[] = [];
  if (tools.generatePdf) {
    toolNotes.push('PDF export queued for Telegram Vault');
  }
  if (tools.createImage) {
    toolNotes.push('Visual concept board staged for Media Library');
  }
  if (tools.attachedFileName) {
    toolNotes.push(`Parsed attached context: ${tools.attachedFileName}`);
  }

  const personaLead: Record<PersonaId, string> = {
    architect: 'Structured this into clear system boundaries and execution order.',
    investigator: 'Cross-checked the core assumptions and mapped key evidence points.',
    mentor: 'Broke this down into calm, clear steps you can act on immediately.',
    critic: 'Pressure-tested the request to isolate bottlenecks and hidden tradeoffs.',
  };

  const hasDeepReasoning = mode === 'deep-think' || mode === 'deep-research';
  const thinkingSummary = hasDeepReasoning
    ? mode === 'deep-think'
      ? `Verified constraints across ${personaInfo.name} lens, checked edge cases, and reconciled dependencies for "${deriveChatTitle(prompt)}".`
      : `Scanned indexed memory vaults and structured current context signals for "${deriveChatTitle(prompt)}".`
    : undefined;

  const thinkingDuration = hasDeepReasoning
    ? mode === 'deep-think'
      ? '2.1s'
      : '1.6s'
    : undefined;

  if (inputMode === 'task') {
    const taskSteps: TaskStep[] = [
      {
        id: `${idSeed}-step-1`,
        label: 'Scope constraints & pull personal intelligence context',
        detail: `Applied ${personaInfo.name} rubric via ${modeInfo.label}`,
        done: true,
      },
      {
        id: `${idSeed}-step-2`,
        label: `Draft primary deliverable for "${deriveChatTitle(prompt)}"`,
        detail: 'Synthesize core recommendations into concise sections',
        done: false,
      },
      {
        id: `${idSeed}-step-3`,
        label: 'Run consistency & edge-case verification pass',
        detail: 'Validate constraints, open risks, and next concrete actions',
        done: false,
      },
      {
        id: `${idSeed}-step-4`,
        label: tools.generatePdf
          ? 'Compile PDF brief and sync to Telegram Vault'
          : 'Archive finalized summary to active Memory Vault',
        detail: tools.generatePdf
          ? 'Ready for one-tap Telegram dispatch once verified'
          : 'Index key decisions for future sessions',
        done: false,
      },
    ];

    return {
      id: `${idSeed}-assistant`,
      role: 'assistant',
      content: `${personaLead[persona]} Created an autonomous checklist you can track step by step.${
        toolNotes.length > 0 ? ` ${toolNotes.join('. ')}.` : ''
      }`,
      timestamp,
      mode,
      persona,
      inputMode,
      thinkingSummary,
      thinkingDuration,
      taskSteps,
      toolsUsed: {
        generatePdf: tools.generatePdf,
        createImage: tools.createImage,
        attachedFileName: tools.attachedFileName,
      },
    };
  }

  const modeReplySuffix: Record<RoutingModeId, string> = {
    auto: 'Routed automatically to balance latency and depth for this prompt.',
    flash: 'Delivered via fast-path inference for immediate iteration.',
    'deep-research':
      'Synthesized key findings with structured takeaways ready for follow-up queries.',
    'deep-think':
      'Multi-agent verification completed with zero unresolved conflicts.',
  };

  return {
    id: `${idSeed}-assistant`,
    role: 'assistant',
    content: `${personaLead[persona]} Here is the focused synthesis for "${deriveChatTitle(
      prompt
    )}": ${modeReplySuffix[mode]}${
      toolNotes.length > 0 ? ` Active tools: ${toolNotes.join(' · ')}.` : ''
    } Reply with any constraint to refine or switch to Task mode to turn this into an executable checklist.`,
    timestamp,
    mode,
    persona,
    inputMode,
    thinkingSummary,
    thinkingDuration,
    toolsUsed: {
      generatePdf: tools.generatePdf,
      createImage: tools.createImage,
      attachedFileName: tools.attachedFileName,
    },
  };
}

export function formatCurrentTime(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
