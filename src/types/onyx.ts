export type RoutingModeId = 'auto' | 'flash' | 'deep-research' | 'deep-think';

export type PersonaId = 'architect' | 'investigator' | 'mentor' | 'critic';

export type InputMode = 'chat' | 'task';

export type SidebarTab = 'chats' | 'media';

export interface RoutingModeOption {
  id: RoutingModeId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface PersonaOption {
  id: PersonaId;
  name: string;
  description: string;
}

export interface ActiveTools {
  generatePdf: boolean;
  createImage: boolean;
  attachedFileName: string | null;
  attachedPreviewUrl?: string | null;
}

export interface TaskSettings {
  autoExpandChecklist: boolean;
  autoAttachPdf: boolean;
}

export type BackendHealthStatus = 'idle' | 'checking' | 'online' | 'degraded';

export interface TaskStep {
  id: string;
  label: string;
  detail: string;
  done: boolean;
}

export interface MediaCard {
  title?: string;
  url?: string;
  imageUrl?: string;
  caption?: string;
  kind?: string;
}

export interface SourceItem {
  title: string;
  url?: string;
  snippet?: string;
}

export interface PdfVaultInfo {
  status?: string;
  filename?: string;
  url?: string;
  message?: string;
  messageId?: string;
}

export interface GeneratedImageArtifact {
  prompt: string;
  url: string;
}

export type BackendChatMode = 'flash' | 'research' | 'deep_think' | 'task';

export interface BackendChatRequest {
  message: string;
  mode: BackendChatMode;
  persona: PersonaId;
  user_id: string | null;
  generate_pdf: boolean;
}

export interface BackendChatResponse {
  answer: string;
  provider?: string | null;
  error?: string | null;
  thinking_log: string | null;
  media_cards: MediaCard[];
  sources: SourceItem[];
  pdf_vault: PdfVaultInfo | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode: RoutingModeId;
  persona: PersonaId;
  inputMode: InputMode;
  thinkingSummary?: string;
  thinkingDuration?: string;
  taskSteps?: TaskStep[];
  mediaCards?: MediaCard[];
  sources?: SourceItem[];
  pdfVault?: PdfVaultInfo | null;
  generatedImage?: GeneratedImageArtifact;
  toolsUsed?: {
    generatePdf?: boolean;
    createImage?: boolean;
    attachedFileName?: string | null;
  };
}

export interface PendingChatError {
  message: string;
  diagnostic?: string;
  retryPrompt: string;
  retryMode: RoutingModeId;
  retryPersona: PersonaId;
  retryInputMode: InputMode;
  retryTools: ActiveTools;
  sessionId: string;
}

export interface OnyxUserProfile {
  id: string | null;
  email: string | null;
  displayName: string;
  initials: string;
  isGuest: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  mode: RoutingModeId;
  messages: ChatMessage[];
}

export interface MemoryVault {
  id: string;
  name: string;
  itemCount: number;
  updatedAt: string;
  summary: string;
  seedPrompt: string;
}

export interface MediaAsset {
  id: string;
  title: string;
  kind: 'PDF' | 'Image' | 'Document';
  size: string;
  createdAt: string;
  destination: string;
}

export interface StarterPrompt {
  id: string;
  iconName: 'compass' | 'stack' | 'terminal';
  text: string;
  suggestedInputMode?: InputMode;
}
