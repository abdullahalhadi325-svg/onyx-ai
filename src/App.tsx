import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Megaphone, X } from '@phosphor-icons/react';
import { AuthScreen } from './components/auth/AuthScreen';
import {
  BootSplash,
  type BootTriggerReason,
} from './components/boot/BootSplash';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';
import { SettingsSheet } from './components/layout/SettingsSheet';
import { LocalAIHubSheet } from './components/local/LocalAIHubSheet';
import { HomeView } from './components/chat/HomeView';
import { ChatThread } from './components/chat/ChatThread';
import { InputDock } from './components/input/InputDock';
import {
  buildChatRequestPayload,
  sendChatToLocalServer,
  sendChatWithSilentFailover,
} from './lib/api';
import {
  DEFAULT_ADMIN_CONFIG,
  fetchLiveAdminConfig,
} from './lib/adminConfig';
import {
  type SpeechLanguageCode,
  buildGracefulFallbackReply,
  buildPollinationsImageUrl,
  createBranchedMessages,
} from './lib/artifacts';
import {
  generateWithNativeLocalLLM,
  getNativeDownloadedModels,
  isNativeLocalLLMAvailable,
  loadNativeModel,
  stopNativeGeneration,
} from './lib/localLLM';
import {
  DEFAULT_LOCAL_SERVER_CONFIG,
  type PersistedWorkspaceSnapshot,
  loadPersistedWorkspace,
  savePersistedWorkspace,
  savePersistedWorkspaceSyncBackup,
} from './lib/storage';
import {
  deriveUserProfile,
  fetchUserChats,
  saveActiveChatMessage,
  supabase,
} from './lib/supabase';
import {
  createInitialUsageStats,
  estimateTokenCount,
  recordMessageUsage,
  rolloverUsageIfNewDay,
} from './lib/usage';
import type {
  ActiveTools,
  AdminConfig,
  ChatMessage,
  ChatSession,
  EngineMode,
  ImageAttachmentPayload,
  InputMode,
  LocalServerConfig,
  LocalServerStatus,
  PersonaId,
  ResponseTone,
  RoutingModeId,
  UsageStats,
} from './types/onyx';
import {
  deriveChatTitle,
  formatCurrentTime,
  toggleTaskStepInMessages,
} from './utils/onyxState';

const RESUME_BOOT_THRESHOLD_MS = 2 * 60 * 1000;

function createSessionId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function deriveGreetingFirstName(
  displayName: string,
  email: string | null,
  isGuest: boolean
): string {
  const savedCustomName =
    typeof window !== "undefined"
      ? window.localStorage.getItem("onyx_user_display_name")?.trim() || ""
      : "";
  if (savedCustomName) {
    return savedCustomName.split(/\s+/)[0];
  }
  if (isGuest) {
    return "Guest";
  }
  const firstWord = displayName.trim().split(/\s+/)[0];
  if (firstWord && firstWord.toLowerCase() !== "guest") {
    return firstWord;
  }
  if (email && email.includes("@")) {
    const prefix = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/)[0];
    if (prefix) return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return "there";
}

function mergeRemoteAndLocalChats(
  localChats: ChatSession[],
  remoteChats: ChatSession[]
): ChatSession[] {
  if (remoteChats.length === 0) {
    return localChats;
  }
  const byId = new Map<string, ChatSession>();
  for (const chat of remoteChats) {
    byId.set(chat.id, chat);
  }
  for (const chat of localChats) {
    const remote = byId.get(chat.id);
    if (!remote || chat.messages.length >= remote.messages.length) {
      byId.set(chat.id, chat);
    }
  }
  return Array.from(byId.values());
}

export default function App() {
  // Authentication state (persisted via Supabase persistSession: true)
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1';
  });

  // Fast 1.3s silent boot choreography (fresh launch, post-login, visibility > 2 min)
  const [bootState, setBootState] = useState<{
    visible: boolean;
    reason: BootTriggerReason;
    runId: number;
  }>({
    visible: true,
    reason: 'launch',
    runId: 1,
  });
  const hiddenTimestampRef = useRef<number | null>(null);

  // Layout overlays
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLocalAIHubOpen, setIsLocalAIHubOpen] = useState(false);

  // Engine, routing, tone & preferences
  const [engineMode, setEngineMode] = useState<EngineMode>('cloud');
  const [routingMode, setRoutingMode] = useState<RoutingModeId>('auto');
  const [persona, setPersona] = useState<PersonaId>('architect');
  const [responseTone, setResponseTone] = useState<ResponseTone>('direct');
  const [inputMode, setInputMode] = useState<InputMode>('chat');
  const [speechLang, setSpeechLang] = useState<SpeechLanguageCode>('en-US');
  const [isTemporaryChat, setIsTemporaryChat] = useState(false);

  // Local AI Server config & live status
  const [localServerConfig, setLocalServerConfig] = useState<LocalServerConfig>(
    DEFAULT_LOCAL_SERVER_CONFIG
  );
  const [localServerStatus, setLocalServerStatus] =
    useState<LocalServerStatus>('idle');
  const [localServerLatencyMs, setLocalServerLatencyMs] = useState<
    number | null
  >(null);
  const [loadedNativeModel, setLoadedNativeModel] = useState<string | null>(
    null
  );
  const [isNativeStreaming, setIsNativeStreaming] = useState(false);

  // Live Admin Config (Supabase onyx_admin_config) & Announcement Banner
  const [adminConfig, setAdminConfig] =
    useState<AdminConfig>(DEFAULT_ADMIN_CONFIG);
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState<string>('');

  // Usage & Token Monitor stats
  const [usageStats, setUsageStats] = useState<UsageStats>(() =>
    createInitialUsageStats()
  );

  // Conversations & workspace data (100% real user data — ZERO hardcoded demo chats)
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [latestRevealingMessageId, setLatestRevealingMessageId] = useState<
    string | null
  >(null);
  const [tempSessionId, setTempSessionId] = useState<string>(() =>
    createSessionId()
  );
  const [tempMessages, setTempMessages] = useState<ChatMessage[]>([]);
  const [isWorkspaceHydrated, setIsWorkspaceHydrated] = useState(false);

  // Input & live request state (zero red error state)
  const [inputValue, setInputValue] = useState('');
  const [activeTools, setActiveTools] = useState<ActiveTools>({
    createImage: false,
    attachedFileName: null,
    attachedPreviewUrl: null,
    attachedImage: null,
  });
  const [isSending, setIsSending] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scopeKey = authUser?.id ? `user_${authUser.id}` : 'guest_local';
  const latestSnapshotRef = useRef<PersistedWorkspaceSnapshot | null>(null);
  const hydratedScopeRef = useRef<string | null>(null);

  const triggerBootSplash = useCallback((reason: BootTriggerReason) => {
    setBootState((prev) => ({
      visible: true,
      reason,
      runId: prev.runId + 1,
    }));
  }, []);

  // Keep latest workspace snapshot in a ref for synchronous flush on minimize/close
  latestSnapshotRef.current = {
    chats,
    activeChatId,
    draftInput: inputValue,
    engineMode,
    routingMode,
    persona,
    responseTone,
    speechLang,
    localServerConfig,
    usageStats,
    updatedAt: Date.now(),
  };

  // Flush synchronously on minimize/pagehide and trigger resume splash if minimized > 2 min
  useEffect(() => {
    function flushSyncBackup() {
      if (isWorkspaceHydrated && hydratedScopeRef.current === scopeKey && latestSnapshotRef.current) {
        savePersistedWorkspaceSyncBackup(scopeKey, {
          ...latestSnapshotRef.current,
          updatedAt: Date.now(),
        });
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenTimestampRef.current = Date.now();
        flushSyncBackup();
      } else if (document.visibilityState === 'visible') {
        const hiddenAt = hiddenTimestampRef.current;
        hiddenTimestampRef.current = null;
        if (hiddenAt && Date.now() - hiddenAt > RESUME_BOOT_THRESHOLD_MS) {
          triggerBootSplash('resume');
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    function handleResumeFreshChat() {
      if (document.visibilityState === "visible") {
        setActiveChatId(null); // fresh chat on resume
      }
    }
    document.addEventListener("visibilitychange", handleResumeFreshChat);
    window.addEventListener('pagehide', flushSyncBackup);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleResumeFreshChat);
      window.removeEventListener('pagehide', flushSyncBackup);
    };
  }, [isWorkspaceHydrated, scopeKey, triggerBootSplash]);

  // Fetch live Supabase admin config on mount
  useEffect(() => {
    let cancelled = false;
    fetchLiveAdminConfig()
      .then((liveConfig) => {
        if (!cancelled) {
          setAdminConfig(liveConfig);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate persistent Supabase auth session on mount and subscribe to auth changes
  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) {
          return;
        }
        setAuthUser(data.session?.user ?? null);
        if (data.session?.user) {
          setIsGuestMode(false);
        }
        setAuthReady(true);
      })
      .catch(() => {
        if (isMounted) {
          setAuthReady(true);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }
      setAuthUser(session?.user ?? null);
      if (session?.user) {
        setIsGuestMode(false);
      }
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Hydrate full persistent workspace from IndexedDB (+ localStorage fallback) & Supabase
  useEffect(() => {
    if (!authReady) {
      return;
    }
    if (!authUser && !isGuestMode) {
      return;
    }

    let cancelled = false;
    hydratedScopeRef.current = null;
    setIsWorkspaceHydrated(false);
    setChats([]);
    setActiveChatId(null);
    setIsLoadingChats(true);

    async function hydrateWorkspace() {
      const localSnapshot = await loadPersistedWorkspace(scopeKey);
      if (cancelled) {
        return;
      }

      let resolvedChats: ChatSession[] = [];
      if (localSnapshot) {
        resolvedChats = Array.isArray(localSnapshot.chats)
          ? localSnapshot.chats
          : [];
        setChats(resolvedChats);
        setActiveChatId(null);
        setInputValue(localSnapshot.draftInput ?? '');
        setEngineMode(localSnapshot.engineMode ?? 'cloud');
        setRoutingMode(localSnapshot.routingMode ?? 'auto');
        setPersona(localSnapshot.persona ?? 'architect');
        setResponseTone(localSnapshot.responseTone ?? 'direct');
        setSpeechLang(localSnapshot.speechLang ?? 'en-US');
        if (localSnapshot.localServerConfig) {
          setLocalServerConfig(localSnapshot.localServerConfig);
        }
        if (localSnapshot.usageStats) {
          const rolled = rolloverUsageIfNewDay(localSnapshot.usageStats);
          setUsageStats({
            ...rolled,
            sessionInputTokens: 0,
            sessionOutputTokens: 0,
          });
        }
      } else {
        setChats([]);
        setActiveChatId(null);
      }

      // If signed in to Supabase, merge remote active_chats cleanly
      if (authUser) {
        try {
          const remoteResult = await fetchUserChats(authUser.id);
          if (!cancelled && !remoteResult.error && remoteResult.sessions.length > 0) {
            const merged = mergeRemoteAndLocalChats(
              resolvedChats,
              remoteResult.sessions
            );
            setChats(merged);
          }
        } catch {
          // Keep local IndexedDB chats seamlessly
        }
      }

      if (!cancelled) {
        hydratedScopeRef.current = scopeKey;
        setIsLoadingChats(false);
        setIsWorkspaceHydrated(true);
      }
    }

    void hydrateWorkspace();
    return () => {
      cancelled = true;
    };
  }, [authReady, authUser, isGuestMode, scopeKey]);

  // Persist workspace to IndexedDB + synchronous localStorage backup whenever state changes
  useEffect(() => {
    if (!isWorkspaceHydrated || hydratedScopeRef.current !== scopeKey) {
      return;
    }

    const snapshot: PersistedWorkspaceSnapshot = {
      chats,
      activeChatId,
      draftInput: inputValue,
      engineMode,
      routingMode,
      persona,
      responseTone,
      speechLang,
      localServerConfig,
      usageStats,
      updatedAt: Date.now(),
    };

    void savePersistedWorkspace(scopeKey, snapshot);
  }, [
    isWorkspaceHydrated,
    scopeKey,
    chats,
    activeChatId,
    inputValue,
    engineMode,
    routingMode,
    persona,
    responseTone,
    speechLang,
    localServerConfig,
    usageStats,
  ]);

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setLatestRevealingMessageId(null);
    setTempMessages([]);
    setTempSessionId(createSessionId());
    setInputValue('');
    setActiveTools({
      createImage: false,
      attachedFileName: null,
      attachedPreviewUrl: null,
      attachedImage: null,
    });
    textareaRef.current?.focus();
  }, []);

  // Global keyboard shortcut Cmd/Ctrl+K for New Chat
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        handleNewChat();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewChat]);

  const userProfile = deriveUserProfile(authUser, isGuestMode);
  const greetingName = deriveGreetingFirstName(
    userProfile.displayName,
    userProfile.email,
    userProfile.isGuest
  );
  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;
  const visibleMessages = isTemporaryChat
    ? tempMessages
    : activeChat?.messages ?? [];
  const hasActiveConversation = visibleMessages.length > 0 || isSending;
  const visibleAnnouncement =
    adminConfig.announcement.trim() &&
    adminConfig.announcement.trim() !== dismissedAnnouncement
      ? adminConfig.announcement.trim()
      : '';

  function handleToggleSpeechLang() {
    setSpeechLang((prev) => (prev === 'en-US' ? 'bn-BD' : 'en-US'));
  }

  function handleToggleTemporaryChat() {
    setLatestRevealingMessageId(null);
    setIsTemporaryChat((prev) => {
      const next = !prev;
      if (next) {
        setActiveChatId(null);
        setTempMessages([]);
        setTempSessionId(createSessionId());
      }
      return next;
    });
  }

  function handleSelectChat(chatId: string) {
    setIsTemporaryChat(false);
    setLatestRevealingMessageId(null);
    setActiveChatId(chatId);
  }

  function handleAttachImage(image: ImageAttachmentPayload | null) {
    setActiveTools((prev) => ({
      ...prev,
      // Auto-disable Create Image (Flux) when an image is attached so Vision takes over
      createImage: image ? false : prev.createImage,
      attachedImage: image,
      attachedFileName: image ? image.fileName : null,
      attachedPreviewUrl: image ? image.previewUrl : null,
    }));
  }

  function handleAttachFile(fileName: string | null) {
    setActiveTools((prev) => ({
      ...prev,
      attachedFileName: fileName,
      attachedPreviewUrl: fileName ? prev.attachedPreviewUrl : null,
      attachedImage: fileName ? prev.attachedImage : null,
    }));
  }

  function handleClearAllHistory() {
    setChats([]);
    setActiveChatId(null);
    setTempMessages([]);
    setLatestRevealingMessageId(null);
  }

  function appendAssistantMessage(
    sessionId: string,
    temporary: boolean,
    mode: RoutingModeId,
    assistantMessage: ChatMessage
  ) {
    setLatestRevealingMessageId(assistantMessage.id);

    if (temporary) {
      setTempMessages((prev) => [...prev, assistantMessage]);
    } else {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === sessionId
            ? {
                ...chat,
                updatedAt: 'Just now',
                mode,
                messages: [...chat.messages, assistantMessage],
              }
            : chat
        )
      );
    }
  }

  function updateAssistantMessageById(
    sessionId: string,
    temporary: boolean,
    messageId: string,
    updater: (msg: ChatMessage) => ChatMessage
  ) {
    if (temporary) {
      setTempMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? updater(msg) : msg))
      );
    } else {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === sessionId
            ? {
                ...chat,
                updatedAt: 'Just now',
                messages: chat.messages.map((msg) =>
                  msg.id === messageId ? updater(msg) : msg
                ),
              }
            : chat
        )
      );
    }
  }

  async function dispatchEngineRequest(params: {
    prompt: string;
    rawUserPrompt: string;
    sessionId: string;
    mode: RoutingModeId;
    persona: PersonaId;
    inputMode: InputMode;
    engine: EngineMode;
    attachedImage: ImageAttachmentPayload | null;
    temporary: boolean;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) {
    const {
      prompt,
      rawUserPrompt,
      sessionId,
      mode,
      persona: reqPersona,
      inputMode: reqInputMode,
      engine,
      attachedImage,
      temporary,
      history,
    } = params;

    setIsSending(true);
    setThinkingStatus(
      engine === 'local'
        ? isNativeLocalLLMAvailable()
          ? 'Running on-device model...'
          : 'Running local server...'
        : attachedImage
          ? 'Analyzing image...'
          : 'Thinking...'
    );

    const estimatedIn = estimateTokenCount(prompt);

    try {
      let answerText = '';
      let thinkingLog: string | undefined;
      let mediaCards = undefined;
      let sources = undefined;
      let isFallback = false;
      let usageIn = estimatedIn;
      let usageOut = 0;

      if (engine === 'local') {
        if (isNativeLocalLLMAvailable()) {
          // Ensure an on-device GGUF model is loaded in native memory
          let activeFile = loadedNativeModel;
          if (!activeFile) {
            const inventory = await getNativeDownloadedModels();
            if (inventory?.loadedModel) {
              activeFile = inventory.loadedModel;
              setLoadedNativeModel(activeFile);
            } else if (inventory && inventory.models.length > 0) {
              const preferred =
                inventory.models.find(
                  (m) => m.fileName === localServerConfig.modelName
                ) ?? inventory.models[0];
              setThinkingStatus(`Loading ${preferred.fileName}...`);
              try {
                const loaded = await loadNativeModel({
                  fileName: preferred.fileName,
                  nCtx: 2048,
                });
                if (loaded.loaded) {
                  activeFile = loaded.fileName;
                  setLoadedNativeModel(loaded.fileName);
                }
              } catch {
                activeFile = null;
              }
            }
          }

          if (activeFile) {
            const streamingMessageId = `msg-${Date.now()}-assistant`;
            const replyTimestamp = formatCurrentTime();
            const streamingShell: ChatMessage = {
              id: streamingMessageId,
              role: 'assistant',
              content: '',
              timestamp: replyTimestamp,
              mode,
              persona: reqPersona,
              inputMode: reqInputMode,
              engine: 'local',
              isStreamingLive: true,
            };

            appendAssistantMessage(sessionId, temporary, mode, streamingShell);
            setIsNativeStreaming(true);
            setThinkingStatus('Generating on-device...');

            try {
              const nativeOutcome = await generateWithNativeLocalLLM({
                message: prompt,
                history,
                systemPrompt: adminConfig.globalSystemPrompt,
                temperature: localServerConfig.temperature,
                maxTokens: localServerConfig.maxTokens,
                onToken: (_token, accumulatedText) => {
                  updateAssistantMessageById(
                    sessionId,
                    temporary,
                    streamingMessageId,
                    (msg) => ({
                      ...msg,
                      content: accumulatedText,
                      isStreamingLive: true,
                    })
                  );
                },
              });

              if (nativeOutcome.ok && nativeOutcome.text) {
                const finalContent = nativeOutcome.text;
                const finalUsageOut =
                  nativeOutcome.tokensGenerated ??
                  estimateTokenCount(finalContent);

                updateAssistantMessageById(
                  sessionId,
                  temporary,
                  streamingMessageId,
                  (msg) => ({
                    ...msg,
                    content: finalContent,
                    isStreamingLive: false,
                  })
                );

                setUsageStats((prev) =>
                  recordMessageUsage(prev, estimatedIn, finalUsageOut)
                );

                if (authUser && !temporary) {
                  void saveActiveChatMessage({
                    userId: authUser.id,
                    sessionId,
                    role: 'assistant',
                    content: finalContent,
                    thinkingLog: null,
                  });
                }
                return;
              }

              // Native generation returned empty/error -> replace shell with polite fallback
              const fallbackText = buildGracefulFallbackReply({
                prompt: rawUserPrompt,
                speechLang,
                isOffline: false,
                isLocalEngine: true,
              });
              updateAssistantMessageById(
                sessionId,
                temporary,
                streamingMessageId,
                (msg) => ({
                  ...msg,
                  content: fallbackText,
                  isStreamingLive: false,
                  isFallback: true,
                })
              );
              setUsageStats((prev) =>
                recordMessageUsage(
                  prev,
                  estimatedIn,
                  estimateTokenCount(fallbackText)
                )
              );
              return;
            } finally {
              setIsNativeStreaming(false);
            }
          }
        }

        // Web browser fallback (or Android fallback if no native GGUF is downloaded yet)
        const localOutcome = await sendChatToLocalServer({
          config: localServerConfig,
          message: prompt,
          history,
          systemPrompt: adminConfig.globalSystemPrompt,
          attachedImage,
        });

        if (localOutcome.ok && localOutcome.response) {
          answerText = localOutcome.response.answer;
          usageIn = localOutcome.response.usage?.inputTokens ?? estimatedIn;
          usageOut =
            localOutcome.response.usage?.outputTokens ??
            estimateTokenCount(answerText);
        } else {
          isFallback = true;
          answerText = buildGracefulFallbackReply({
            prompt: rawUserPrompt,
            speechLang,
            isOffline: false,
            isLocalEngine: true,
          });
          usageOut = estimateTokenCount(answerText);
        }
      } else {
        const payload = buildChatRequestPayload({
          userId: authUser?.id ?? null,
          message: prompt,
          history,
          routingMode: mode,
          inputMode: reqInputMode,
          persona: reqPersona,
          tone: responseTone,
          adminConfig,
          attachedImage,
        });

        const cloudOutcome = await sendChatWithSilentFailover({
          payload,
          adminConfig,
          onStatusChange: (label) => setThinkingStatus(label),
        });

        if (cloudOutcome.ok && cloudOutcome.response) {
          answerText = cloudOutcome.response.answer;
          thinkingLog = cloudOutcome.response.thinking_log ?? undefined;
          mediaCards =
            cloudOutcome.response.media_cards.length > 0
              ? cloudOutcome.response.media_cards
              : undefined;
          sources =
            cloudOutcome.response.sources.length > 0
              ? cloudOutcome.response.sources
              : undefined;
          usageIn = cloudOutcome.response.usage?.inputTokens ?? estimatedIn;
          usageOut =
            cloudOutcome.response.usage?.outputTokens ??
            estimateTokenCount(answerText);
        } else {
          // NEVER show a red error card — render polite bilingual fallback inside a normal assistant bubble
          isFallback = true;
          answerText = buildGracefulFallbackReply({
            prompt: rawUserPrompt,
            speechLang,
            isOffline: cloudOutcome.isOffline,
          });
          usageOut = estimateTokenCount(answerText);
        }
      }

      const replyTimestamp = formatCurrentTime();
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: answerText,
        timestamp: replyTimestamp,
        mode,
        persona: reqPersona,
        inputMode: reqInputMode,
        engine,
        thinkingSummary: thinkingLog,
        mediaCards,
        sources,
        isFallback,
      };

      appendAssistantMessage(sessionId, temporary, mode, assistantMessage);

      setUsageStats((prev) => recordMessageUsage(prev, usageIn, usageOut));

      // Persist assistant response to Supabase active_chats when authenticated, non-temporary, and non-fallback
      if (authUser && !temporary && !isFallback) {
        void saveActiveChatMessage({
          userId: authUser.id,
          sessionId,
          role: 'assistant',
          content: assistantMessage.content,
          thinkingLog: thinkingLog ?? null,
          mediaCards,
        });
      }
    } finally {
      setIsSending(false);
      setThinkingStatus(null);
    }
  }

  async function handleSendMessage() {
    if (isSending) {
      return;
    }

    const trimmed = inputValue.trim();
    const attachedImage = activeTools.attachedImage ?? null;
    const effectivePrompt =
      trimmed ||
      (attachedImage
        ? 'Analyze this attached image in detail.'
        : activeTools.attachedFileName
          ? `Analyze attached file: ${activeTools.attachedFileName}`
          : activeTools.createImage
            ? 'Create a visual concept mockup'
            : '');

    if (!effectivePrompt) {
      return;
    }

    const messageText =
      activeTools.attachedFileName &&
      !attachedImage &&
      !effectivePrompt.includes(activeTools.attachedFileName)
        ? `${effectivePrompt}\n\n[Attached file: ${activeTools.attachedFileName}]`
        : effectivePrompt;

    const timestamp = formatCurrentTime();
    const currentTools: ActiveTools = { ...activeTools };
    const sessionId = isTemporaryChat
      ? tempSessionId
      : activeChatId ?? createSessionId();

    const priorHistory = visibleMessages
      .filter((msg) => !msg.isFallback && msg.content.trim().length > 0)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: effectivePrompt,
      timestamp,
      mode: routingMode,
      persona,
      inputMode,
      engine: engineMode,
      attachedImagePreview: attachedImage?.previewUrl,
      toolsUsed: {
        createImage: !attachedImage && currentTools.createImage,
        attachedFileName: currentTools.attachedFileName,
      },
    };

    if (isTemporaryChat) {
      setTempMessages((prev) => [...prev, userMessage]);
    } else if (activeChatId) {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                updatedAt: 'Just now',
                mode: routingMode,
                messages: [...chat.messages, userMessage],
              }
            : chat
        )
      );
    } else {
      const newChat: ChatSession = {
        id: sessionId,
        title: deriveChatTitle(effectivePrompt),
        updatedAt: 'Just now',
        mode: routingMode,
        messages: [userMessage],
      };
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(sessionId);
    }

    setInputValue('');
    setActiveTools({
      createImage: false,
      attachedFileName: null,
      attachedPreviewUrl: null,
      attachedImage: null,
    });

    // Persist user message to Supabase active_chats when authenticated & non-temporary
    if (authUser && !isTemporaryChat) {
      void saveActiveChatMessage({
        userId: authUser.id,
        sessionId,
        role: 'user',
        content: effectivePrompt,
      });
    }

    // Direct Pollinations Flux image generation ONLY when Create Image is enabled and NO image is attached
    if (currentTools.createImage && !attachedImage) {
      const imageUrl = buildPollinationsImageUrl(effectivePrompt);
      const imageReplyTimestamp = formatCurrentTime();
      const imageAssistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-image`,
        role: 'assistant',
        content: `Generated image for **${effectivePrompt}**.`,
        timestamp: imageReplyTimestamp,
        mode: routingMode,
        persona,
        inputMode,
        engine: 'cloud',
        generatedImage: {
          prompt: effectivePrompt,
          url: imageUrl,
        },
      };

      appendAssistantMessage(
        sessionId,
        isTemporaryChat,
        routingMode,
        imageAssistantMessage
      );

      setUsageStats((prev) =>
        recordMessageUsage(prev, estimateTokenCount(effectivePrompt), 12)
      );

      if (authUser && !isTemporaryChat) {
        void saveActiveChatMessage({
          userId: authUser.id,
          sessionId,
          role: 'assistant',
          content: imageAssistantMessage.content,
          mediaCards: [
            {
              title: effectivePrompt,
              imageUrl,
              url: imageUrl,
              kind: 'pollinations',
            },
          ],
        });
      }

      return;
    }

    await dispatchEngineRequest({
      prompt: messageText,
      rawUserPrompt: effectivePrompt,
      sessionId,
      mode: routingMode,
      persona,
      inputMode,
      engine: engineMode,
      attachedImage,
      temporary: isTemporaryChat,
      history: priorHistory,
    });
  }

  async function handleRegenerateMessage(assistantMessageId: string) {
    if (isSending) {
      return;
    }

    const thread = visibleMessages;
    const targetIndex = thread.findIndex((msg) => msg.id === assistantMessageId);
    if (targetIndex === -1) {
      return;
    }

    let precedingUserPrompt: string | null = null;
    let precedingUserIndex = -1;
    for (let i = targetIndex - 1; i >= 0; i -= 1) {
      if (thread[i].role === 'user') {
        precedingUserPrompt = thread[i].content;
        precedingUserIndex = i;
        break;
      }
    }

    if (!precedingUserPrompt || precedingUserIndex === -1) {
      return;
    }

    const sessionId = isTemporaryChat
      ? tempSessionId
      : activeChatId ?? createSessionId();

    const priorHistory = thread
      .slice(0, precedingUserIndex)
      .filter((m) => !m.isFallback && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    await dispatchEngineRequest({
      prompt: precedingUserPrompt,
      rawUserPrompt: precedingUserPrompt,
      sessionId,
      mode: routingMode,
      persona,
      inputMode,
      engine: engineMode,
      attachedImage: null,
      temporary: isTemporaryChat,
      history: priorHistory,
    });
  }

  function handleBranchFromMessage(messageId: string) {
    const branchedMessages = createBranchedMessages(visibleMessages, messageId);
    if (branchedMessages.length === 0) {
      return;
    }

    const newSessionId = createSessionId();
    const baseTitle =
      activeChat?.title || deriveChatTitle(branchedMessages[0].content);
    const branchedChat: ChatSession = {
      id: newSessionId,
      title: `Branch · ${baseTitle}`,
      updatedAt: 'Just now',
      mode: routingMode,
      messages: branchedMessages.map((msg, idx) => ({
        ...msg,
        id: `${msg.id}-branch-${Date.now()}-${idx}`,
      })),
    };

    setIsTemporaryChat(false);
    setLatestRevealingMessageId(null);
    setChats((prev) => [branchedChat, ...prev]);
    setActiveChatId(newSessionId);
  }

  function handleToggleTaskStep(messageId: string, stepId: string) {
    if (isTemporaryChat) {
      setTempMessages((prev) =>
        toggleTaskStepInMessages(prev, messageId, stepId)
      );
      return;
    }

    if (!activeChatId) {
      return;
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: toggleTaskStepInMessages(
                chat.messages,
                messageId,
                stepId
              ),
            }
          : chat
      )
    );
  }

  async function handleSignOut() {
    if (authUser) {
      await supabase.auth.signOut();
    }
    setAuthUser(null);
    setIsGuestMode(false);
    setIsSettingsOpen(false);
    setIsSidebarOpen(false);
    setIsLocalAIHubOpen(false);
    setActiveChatId(null);
    setLatestRevealingMessageId(null);
    setTempMessages([]);
  }

  const handleBootComplete = useCallback(() => {
    setBootState((prev) => ({ ...prev, visible: false }));
  }, []);

  // Auth Gate when user is neither signed in nor in Guest mode
  if (authReady && !authUser && !isGuestMode) {
    return (
      <>
        <AuthScreen
          onContinueAsGuest={() => {
            setIsGuestMode(true);
            triggerBootSplash('login');
          }}
          onAuthSuccess={() => triggerBootSplash('login')}
        />
        <BootSplash
          key={bootState.runId}
          isVisible={bootState.visible}
          triggerReason={bootState.reason}
          onComplete={handleBootComplete}
        />
      </>
    );
  }

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-x-hidden bg-[#000000] text-white">
      {/* Lush Diffused Sapphire Bottom Horizon Glow (100% on Home -> 10% inside Active Chats) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          hasActiveConversation ? 'opacity-10' : 'opacity-100'
        }`}
      >
        <div className="absolute -bottom-36 left-1/2 h-[380px] w-[min(820px,165vw)] -translate-x-1/2 rounded-full bg-[#1D4ED8]/42 blur-[115px]" />
        <div className="absolute -bottom-16 left-1/2 h-[220px] w-[min(520px,125vw)] -translate-x-1/2 rounded-full bg-[#38BDF8]/26 blur-[85px]" />
      </div>

      <TopBar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        engineMode={engineMode}
        onChangeEngineMode={setEngineMode}
        onOpenLocalAIHub={() => setIsLocalAIHubOpen(true)}
        routingMode={routingMode}
        onSelectRoutingMode={setRoutingMode}
        persona={persona}
        onSelectPersona={setPersona}
        isTemporaryChat={isTemporaryChat}
        onToggleTemporaryChat={handleToggleTemporaryChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
        userInitials={userProfile.initials}
      />

      {/* Optional Live Admin Announcement Banner */}
      {visibleAnnouncement && (
        <div className="relative z-20 mx-auto mt-16 w-full max-w-[680px] px-4">
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#111524] px-3.5 py-2 text-xs text-blue-100">
            <span className="flex min-w-0 items-center gap-2">
              <Megaphone size={14} weight="fill" className="shrink-0 text-blue-400" />
              <span className="truncate">{visibleAnnouncement}</span>
            </span>
            <button
              type="button"
              onClick={() => setDismissedAnnouncement(visibleAnnouncement)}
              aria-label="Dismiss announcement"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-white"
            >
              <X size={12} weight="bold" />
            </button>
          </div>
        </div>
      )}

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        chats={chats}
        isLoadingChats={isLoadingChats}
        activeChatId={activeChatId}
        engineMode={engineMode}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onOpenLocalAIHub={() => setIsLocalAIHubOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        userProfile={userProfile}
      />

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {!hasActiveConversation ? (
          <HomeView
            greetingName={greetingName}
            inputMode={inputMode}
            onChangeInputMode={setInputMode}
            speechLang={speechLang}
            onToggleSpeechLang={handleToggleSpeechLang}
            isTemporaryChat={isTemporaryChat}
          />
        ) : (
          <ChatThread
            messages={visibleMessages}
            latestRevealingMessageId={latestRevealingMessageId}
            isTemporaryChat={isTemporaryChat}
            isSending={isSending}
            statusMessage={thinkingStatus}
            activeEngineMode={engineMode}
            activeRoutingMode={routingMode}
            activePersona={persona}
            activeInputMode={inputMode}
            onToggleTaskStep={handleToggleTaskStep}
            onRegenerateMessage={(messageId) => {
              void handleRegenerateMessage(messageId);
            }}
            onBranchFromMessage={handleBranchFromMessage}
          />
        )}
      </main>

      <div className="relative z-20">
        <InputDock
          value={inputValue}
          onChange={setInputValue}
          inputMode={inputMode}
          onChangeInputMode={setInputMode}
          speechLang={speechLang}
          onToggleSpeechLang={handleToggleSpeechLang}
          routingMode={routingMode}
          onSelectRoutingMode={setRoutingMode}
          activeTools={activeTools}
          onToggleCreateImage={() =>
            setActiveTools((prev) => ({
              ...prev,
              createImage: prev.attachedImage ? false : !prev.createImage,
            }))
          }
          onAttachFile={handleAttachFile}
          onAttachImage={handleAttachImage}
          onSubmit={() => void handleSendMessage()}
          isSending={isSending}
          canStopGeneration={isNativeStreaming}
          onStopGeneration={() => void stopNativeGeneration()}
          textareaRef={textareaRef}
        />
      </div>

      <LocalAIHubSheet
        isOpen={isLocalAIHubOpen}
        onClose={() => setIsLocalAIHubOpen(false)}
        engineMode={engineMode}
        onChangeEngineMode={setEngineMode}
        config={localServerConfig}
        onChangeConfig={setLocalServerConfig}
        serverStatus={localServerStatus}
        serverLatencyMs={localServerLatencyMs}
        onUpdateServerStatus={(status, latencyMs) => {
          setLocalServerStatus(status);
          setLocalServerLatencyMs(latencyMs);
        }}
        loadedNativeModel={loadedNativeModel}
        onChangeLoadedNativeModel={setLoadedNativeModel}
      />

      <SettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userProfile={userProfile}
        engineMode={engineMode}
        onChangeEngineMode={setEngineMode}
        onOpenLocalAIHub={() => setIsLocalAIHubOpen(true)}
        persona={persona}
        onSelectPersona={setPersona}
        responseTone={responseTone}
        onSelectResponseTone={setResponseTone}
        speechLang={speechLang}
        onToggleSpeechLang={handleToggleSpeechLang}
        usageStats={usageStats}
        adminConfig={adminConfig}
        onUpdateAdminConfig={setAdminConfig}
        chats={chats}
        onClearAllHistory={handleClearAllHistory}
        onSignOut={handleSignOut}
      />

      {/* Fast 1.3s Silent Animated Boot Overlay */}
      <BootSplash
        key={bootState.runId}
        isVisible={bootState.visible}
        triggerReason={bootState.reason}
        onComplete={handleBootComplete}
      />
    </div>
  );
}
