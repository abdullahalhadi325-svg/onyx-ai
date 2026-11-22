export type RoutingModeId = 'auto' | 'flash' | 'deep-research' | 'deep-think';

export type PersonaId = 'architect' | 'investigator' | 'mentor' | 'critic';

export type InputMode = 'chat' | 'task';

export type EngineMode = 'cloud' | 'local';

export type ResponseTone = 'direct' | 'balanced' | 'concise' | 'detailed';

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

export interface ImageAttachmentPayload {
  fileName: string;
  mimeType: string;
  base64Data: string;
  previewUrl: string;
}

export interface ActiveTools {
  createImage: boolean;
  attachedFileName: string | null;
  attachedPreviewUrl?: string | null;
  attachedImage?: ImageAttachmentPayload | null;
}

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

export interface GeneratedImageArtifact {
  prompt: string;
  url: string;
}

export type BackendChatMode = 'flash' | 'research' | 'deep_think' | 'task';

export interface ConversationHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface BackendChatRequest {
  message: string;
  messages: ConversationHistoryItem[];
  history: ConversationHistoryItem[];
  mode: BackendChatMode;
  persona: PersonaId;
  user_id: string | null;
  system_prompt?: string;
  tone?: ResponseTone;
  language?: 'bn' | 'en';
  preferred_providers?: string[];
  force_provider?: 'gemini';
  vision?: boolean;
  image_base64?: string;
  image_mime_type?: string;
  attachments?: Array<{
    type: 'image';
    mimeType: string;
    data: string;
    fileName?: string;
  }>;
}

export interface BackendChatResponse {
  answer: string;
  provider?: string | null;
  error?: string | null;
  thinking_log: string | null;
  media_cards: MediaCard[];
  sources: SourceItem[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode: RoutingModeId;
  persona: PersonaId;
  inputMode: InputMode;
  engine?: EngineMode;
  thinkingSummary?: string;
  thinkingDuration?: string;
  taskSteps?: TaskStep[];
  mediaCards?: MediaCard[];
  sources?: SourceItem[];
  generatedImage?: GeneratedImageArtifact;
  attachedImagePreview?: string;
  isFallback?: boolean;
  isStreamingLive?: boolean;
  toolsUsed?: {
    createImage?: boolean;
    attachedFileName?: string | null;
  };
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

export interface LocalModelEntry {
  id: string;
  name: string;
  quantization: string;
  category: 'general' | 'uncensored';
  size: string;
  ramRequired: string;
  recommendedFor: string;
  description: string;
  fileName: string;
  huggingfaceUrl: string;
}

export interface LocalServerConfig {
  endpointUrl: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
}

export type LocalServerStatus = 'idle' | 'checking' | 'connected' | 'offline';

export interface DownloadedLocalModel {
  fileName: string;
  sizeBytes: number;
  sizeMB: number;
  lastModified: number;
  isLoaded: boolean;
}

export interface PartialLocalModelDownload {
  fileName: string;
  downloadedBytes: number;
  downloadedMB: number;
}

export interface LocalLLMInventoryResponse {
  models: DownloadedLocalModel[];
  partials: PartialLocalModelDownload[];
  loadedModel: string | null;
  availableStorageBytes: number;
  totalStorageBytes: number;
  modelsStorageBytes: number;
  nativeReady: boolean;
}

export type LocalDownloadStatus =
  | 'downloading'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'error';

export interface LocalLLMDownloadProgressEvent {
  modelId: string;
  fileName: string;
  downloadedBytes: number;
  totalBytes: number;
  downloadedMB: number;
  totalMB: number;
  progress: number;
  speedMBps: number;
  status: LocalDownloadStatus;
  error?: string;
}

export interface LocalLLMTokenEvent {
  requestId?: string;
  token: string;
}

export interface LocalLLMCompleteEvent {
  requestId?: string;
  text: string;
  tokensGenerated?: number;
  tokensPerSecond?: number;
  modelFileName?: string;
}

export interface LocalLLMErrorEvent {
  requestId?: string;
  message: string;
}

export interface CapacitorPluginListenerHandle {
  remove: () => Promise<void> | void;
}

export interface NativeLocalLLMPlugin {
  downloadModel(options: {
    url: string;
    fileName: string;
    modelId?: string;
  }): Promise<{
    fileName: string;
    sizeBytes?: number;
    downloadedBytes?: number;
    totalBytes?: number;
    status: LocalDownloadStatus;
  }>;
  pauseDownload(options: { fileName: string }): Promise<{ paused: boolean }>;
  cancelDownload(options: { fileName: string }): Promise<{ cancelled: boolean }>;
  getDownloadedModels(): Promise<LocalLLMInventoryResponse>;
  deleteModel(options: { fileName: string }): Promise<{
    deleted: boolean;
    fileName: string;
  }>;
  loadModel(options: {
    fileName: string;
    nCtx?: number;
    nThreads?: number;
  }): Promise<{
    loaded: boolean;
    fileName: string;
    nCtx: number;
    nThreads: number;
  }>;
  importModelFromFile?: () => Promise<{ imported: boolean; fileName: string; sizeBytes: number }>;
  unloadModel(): Promise<{ unloaded: boolean }>;
  generate(options: {
    requestId?: string;
    prompt?: string;
    systemPrompt?: string;
    messages?: ConversationHistoryItem[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<LocalLLMCompleteEvent>;
  stopGeneration(): Promise<{ stopped: boolean }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: LocalLLMDownloadProgressEvent) => void
  ): Promise<CapacitorPluginListenerHandle>;
  addListener(
    eventName: 'onToken',
    listenerFunc: (event: LocalLLMTokenEvent) => void
  ): Promise<CapacitorPluginListenerHandle>;
  addListener(
    eventName: 'onComplete',
    listenerFunc: (event: LocalLLMCompleteEvent) => void
  ): Promise<CapacitorPluginListenerHandle>;
  addListener(
    eventName: 'onError',
    listenerFunc: (event: LocalLLMErrorEvent) => void
  ): Promise<CapacitorPluginListenerHandle>;
}

export interface UsageStats {
  dateKey: string;
  dailyMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  sessionInputTokens: number;
  sessionOutputTokens: number;
}

export interface ProviderToggles {
  gemini: boolean;
  groq: boolean;
  openrouter: boolean;
  cloudflare: boolean;
}

export interface AdminConfig {
  globalSystemPrompt: string;
  enabledProviders: ProviderToggles;
  dailyMessageLimit: number;
  announcement: string;
  telegramBotToken: string;
  telegramChatId: string;
  adminPinHash?: string;
}
