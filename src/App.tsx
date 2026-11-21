import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AuthScreen } from './components/auth/AuthScreen';
import {
  BootSplash,
  type BootTriggerReason,
} from './components/boot/BootSplash';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';
import { SettingsSheet } from './components/layout/SettingsSheet';
import { HomeView } from './components/chat/HomeView';
import { ChatThread } from './components/chat/ChatThread';
import { InputDock } from './components/input/InputDock';
import {
  OnyxBackendError,
  buildChatRequestPayload,
  sendChatToBackend,
} from './lib/api';
import {
  type SpeechLanguageCode,
  FRIENDLY_ENGINE_ERROR_MESSAGE,
  buildPollinationsImageUrl,
  createBranchedMessages,
  extractErrorDiagnostic,
} from './lib/artifacts';
import {
  deriveUserProfile,
  fetchUserChats,
  saveActiveChatMessage,
  supabase,
} from './lib/supabase';
import type {
  ActiveTools,
  ChatMessage,
  ChatSession,
  InputMode,
  MemoryVault,
  PendingChatError,
  PersonaId,
  RoutingModeId,
} from './types/onyx';
import {
  INITIAL_CHATS,
  INITIAL_MEMORY_VAULTS,
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
  if (isGuest) {
    return 'Hadi';
  }
  const combined = `${displayName} ${email ?? ''}`.toLowerCase();
  if (combined.includes('hadi')) {
    return 'Hadi';
  }
  const firstWord = displayName.trim().split(/\s+/)[0];
  return firstWord || 'Hadi';
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

  // Active routing & composer controls
  const [routingMode, setRoutingMode] = useState<RoutingModeId>('auto');
  const [persona, setPersona] = useState<PersonaId>('architect');
  const [inputMode, setInputMode] = useState<InputMode>('chat');
  const [speechLang, setSpeechLang] = useState<SpeechLanguageCode>('en-US');
  const [isTemporaryChat, setIsTemporaryChat] = useState(false);
  const [isPersonalIntelligenceEnabled, setIsPersonalIntelligenceEnabled] =
    useState(true);

  // Conversations & workspace data
  const [chats, setChats] = useState<ChatSession[]>(INITIAL_CHATS);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [latestRevealingMessageId, setLatestRevealingMessageId] = useState<
    string | null
  >(null);
  const [tempSessionId, setTempSessionId] = useState<string>(() =>
    createSessionId()
  );
  const [tempMessages, setTempMessages] = useState<ChatMessage[]>([]);
  const [vaults, setVaults] = useState<MemoryVault[]>(INITIAL_MEMORY_VAULTS);

  // Input & live Cloudflare Worker request state
  const [inputValue, setInputValue] = useState('');
  const [activeTools, setActiveTools] = useState<ActiveTools>({
    generatePdf: false,
    createImage: false,
    attachedFileName: null,
    attachedPreviewUrl: null,
  });
  const [isSending, setIsSending] = useState(false);
  const [pendingError, setPendingError] = useState<PendingChatError | null>(
    null
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const triggerBootSplash = useCallback((reason: BootTriggerReason) => {
    setBootState((prev) => ({
      visible: true,
      reason,
      runId: prev.runId + 1,
    }));
  }, []);

  // Re-run silent boot animation when returning after > 2 minutes in background
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenTimestampRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const hiddenAt = hiddenTimestampRef.current;
        hiddenTimestampRef.current = null;
        if (hiddenAt && Date.now() - hiddenAt > RESUME_BOOT_THRESHOLD_MS) {
          triggerBootSplash('resume');
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [triggerBootSplash]);

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

  // Load persisted Supabase chats when authenticated
  useEffect(() => {
    if (!authUser) {
      if (isGuestMode) {
        setChats(INITIAL_CHATS);
      }
      return;
    }

    let cancelled = false;
    setIsLoadingChats(true);

    fetchUserChats(authUser.id)
      .then((chatsResult) => {
        if (cancelled) {
          return;
        }
        if (!chatsResult.error) {
          setChats(chatsResult.sessions);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingChats(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authUser, isGuestMode]);

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setLatestRevealingMessageId(null);
    setTempMessages([]);
    setTempSessionId(createSessionId());
    setPendingError(null);
    setInputValue('');
    setActiveTools({
      generatePdf: false,
      createImage: false,
      attachedFileName: null,
      attachedPreviewUrl: null,
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

  function handleToggleSpeechLang() {
    setSpeechLang((prev) => (prev === 'en-US' ? 'bn-BD' : 'en-US'));
  }

  function handleToggleTemporaryChat() {
    setPendingError(null);
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

  function handleSelectVault(vault: MemoryVault) {
    setInputValue(vault.seedPrompt);
    textareaRef.current?.focus();
  }

  function handleSelectChat(chatId: string) {
    setIsTemporaryChat(false);
    setPendingError(null);
    setLatestRevealingMessageId(null);
    setActiveChatId(chatId);
  }

  async function dispatchBackendRequest(params: {
    prompt: string;
    sessionId: string;
    mode: RoutingModeId;
    persona: PersonaId;
    inputMode: InputMode;
    tools: ActiveTools;
    temporary: boolean;
  }) {
    const {
      prompt,
      sessionId,
      mode,
      persona: reqPersona,
      inputMode: reqInputMode,
      tools,
      temporary,
    } = params;

    setIsSending(true);
    setPendingError(null);

    try {
      const payload = buildChatRequestPayload({
        userId: authUser?.id ?? null,
        message: prompt,
        routingMode: mode,
        inputMode: reqInputMode,
        persona: reqPersona,
        generatePdf: tools.generatePdf,
      });

      const backendResult = await sendChatToBackend(payload);
      const replyTimestamp = formatCurrentTime();

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: backendResult.answer,
        timestamp: replyTimestamp,
        mode,
        persona: reqPersona,
        inputMode: reqInputMode,
        thinkingSummary: backendResult.thinking_log ?? undefined,
        mediaCards:
          backendResult.media_cards.length > 0
            ? backendResult.media_cards
            : undefined,
        sources:
          backendResult.sources.length > 0 ? backendResult.sources : undefined,
        pdfVault: backendResult.pdf_vault,
      };

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

      // Persist assistant response to Supabase active_chats when authenticated & non-temporary
      if (authUser && !temporary) {
        void saveActiveChatMessage({
          userId: authUser.id,
          sessionId,
          role: 'assistant',
          content: assistantMessage.content,
          thinkingLog: backendResult.thinking_log,
          mediaCards: backendResult.media_cards,
        });
      }
    } catch (error) {
      const diagnostic =
        error instanceof OnyxBackendError
          ? error.diagnostic
          : error instanceof Error
            ? extractErrorDiagnostic(error.message)
            : 'Unexpected backend error';

      setPendingError({
        message: FRIENDLY_ENGINE_ERROR_MESSAGE,
        diagnostic,
        retryPrompt: prompt,
        retryMode: mode,
        retryPersona: reqPersona,
        retryInputMode: reqInputMode,
        retryTools: tools,
        sessionId,
      });
    } finally {
      setIsSending(false);
    }
  }

  async function handleSendMessage() {
    if (isSending) {
      return;
    }

    const trimmed = inputValue.trim();
    const effectivePrompt =
      trimmed ||
      (activeTools.attachedFileName
        ? `Analyze attached file: ${activeTools.attachedFileName}`
        : activeTools.generatePdf
          ? 'Generate a structured PDF summary for Telegram'
          : activeTools.createImage
            ? 'Create a visual concept mockup'
            : '');

    if (!effectivePrompt) {
      return;
    }

    const messageText =
      activeTools.attachedFileName &&
      !effectivePrompt.includes(activeTools.attachedFileName)
        ? `${effectivePrompt}\n\n[Attached file: ${activeTools.attachedFileName}]`
        : effectivePrompt;

    const timestamp = formatCurrentTime();
    const currentTools: ActiveTools = { ...activeTools };
    const sessionId = isTemporaryChat
      ? tempSessionId
      : activeChatId ?? createSessionId();

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: effectivePrompt,
      timestamp,
      mode: routingMode,
      persona,
      inputMode,
      toolsUsed: {
        generatePdf: currentTools.generatePdf,
        createImage: currentTools.createImage,
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
      generatePdf: false,
      createImage: false,
      attachedFileName: null,
      attachedPreviewUrl: null,
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

    // Direct Pollinations Flux image generation when Create Image toggle is enabled
    if (currentTools.createImage) {
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
        generatedImage: {
          prompt: effectivePrompt,
          url: imageUrl,
        },
      };

      setLatestRevealingMessageId(imageAssistantMessage.id);

      if (isTemporaryChat) {
        setTempMessages((prev) => [...prev, imageAssistantMessage]);
      } else {
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === sessionId
              ? {
                  ...chat,
                  updatedAt: 'Just now',
                  mode: routingMode,
                  messages: [...chat.messages, imageAssistantMessage],
                }
              : chat
          )
        );
      }

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

    await dispatchBackendRequest({
      prompt: messageText,
      sessionId,
      mode: routingMode,
      persona,
      inputMode,
      tools: currentTools,
      temporary: isTemporaryChat,
    });
  }

  async function handleRetryLastRequest() {
    if (!pendingError || isSending) {
      return;
    }

    await dispatchBackendRequest({
      prompt: pendingError.retryPrompt,
      sessionId: pendingError.sessionId,
      mode: pendingError.retryMode,
      persona: pendingError.retryPersona,
      inputMode: pendingError.retryInputMode,
      tools: pendingError.retryTools,
      temporary: isTemporaryChat,
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
    for (let i = targetIndex - 1; i >= 0; i -= 1) {
      if (thread[i].role === 'user') {
        precedingUserPrompt = thread[i].content;
        break;
      }
    }

    if (!precedingUserPrompt) {
      return;
    }

    const sessionId = isTemporaryChat
      ? tempSessionId
      : activeChatId ?? createSessionId();

    await dispatchBackendRequest({
      prompt: precedingUserPrompt,
      sessionId,
      mode: routingMode,
      persona,
      inputMode,
      tools: {
        generatePdf: false,
        createImage: false,
        attachedFileName: null,
        attachedPreviewUrl: null,
      },
      temporary: isTemporaryChat,
    });
  }

  function handleSaveMessageToVault(message: ChatMessage) {
    const timestamp = formatCurrentTime();
    setVaults((prev) => {
      const existingSaved = prev.find((v) => v.id === 'vault-saved-insights');
      if (existingSaved) {
        return prev.map((v) =>
          v.id === 'vault-saved-insights'
            ? {
                ...v,
                itemCount: v.itemCount + 1,
                updatedAt: `Today, ${timestamp}`,
                summary: deriveChatTitle(message.content),
              }
            : v
        );
      }

      const newVault: MemoryVault = {
        id: 'vault-saved-insights',
        name: 'Saved Insights',
        itemCount: 1,
        updatedAt: `Today, ${timestamp}`,
        summary: deriveChatTitle(message.content),
        seedPrompt: `Recall my saved insights starting with: ${deriveChatTitle(
          message.content
        )}`,
      };
      return [newVault, ...prev];
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
    setPendingError(null);
    setLatestRevealingMessageId(null);
    setChats((prev) => [branchedChat, ...prev]);
    setActiveChatId(newSessionId);
  }

  async function handleExportMessagePdf(message: ChatMessage) {
    if (isSending) {
      return;
    }
    const sessionId = isTemporaryChat
      ? tempSessionId
      : activeChatId ?? createSessionId();

    await dispatchBackendRequest({
      prompt: `Format and export the following response as a clean Telegram Vault PDF brief:\n\n${message.content}`,
      sessionId,
      mode: routingMode,
      persona,
      inputMode: 'chat',
      tools: {
        generatePdf: true,
        createImage: false,
        attachedFileName: null,
        attachedPreviewUrl: null,
      },
      temporary: isTemporaryChat,
    });
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
    setActiveChatId(null);
    setLatestRevealingMessageId(null);
    setTempMessages([]);
    setPendingError(null);
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
        routingMode={routingMode}
        onSelectRoutingMode={setRoutingMode}
        persona={persona}
        onSelectPersona={setPersona}
        isTemporaryChat={isTemporaryChat}
        onToggleTemporaryChat={handleToggleTemporaryChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
        userInitials={userProfile.initials}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        chats={chats}
        isLoadingChats={isLoadingChats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
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
            activeRoutingMode={routingMode}
            activePersona={persona}
            activeInputMode={inputMode}
            pendingError={pendingError}
            onRetry={handleRetryLastRequest}
            onToggleTaskStep={handleToggleTaskStep}
            onRegenerateMessage={(messageId) => {
              void handleRegenerateMessage(messageId);
            }}
            onSaveMessageToVault={handleSaveMessageToVault}
            onBranchFromMessage={handleBranchFromMessage}
            onExportMessagePdf={(message) => {
              void handleExportMessagePdf(message);
            }}
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
          onToggleGeneratePdf={() =>
            setActiveTools((prev) => ({
              ...prev,
              generatePdf: !prev.generatePdf,
            }))
          }
          onToggleCreateImage={() =>
            setActiveTools((prev) => ({
              ...prev,
              createImage: !prev.createImage,
            }))
          }
          onAttachFile={(fileName, previewUrl) =>
            setActiveTools((prev) => ({
              ...prev,
              attachedFileName: fileName,
              attachedPreviewUrl: previewUrl ?? null,
            }))
          }
          isPersonalIntelligenceEnabled={isPersonalIntelligenceEnabled}
          onTogglePersonalIntelligence={() =>
            setIsPersonalIntelligenceEnabled((prev) => !prev)
          }
          vaults={vaults}
          onSelectVault={handleSelectVault}
          onSubmit={handleSendMessage}
          isSending={isSending}
          textareaRef={textareaRef}
        />
      </div>

      <SettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userProfile={userProfile}
        persona={persona}
        onSelectPersona={setPersona}
        speechLang={speechLang}
        onToggleSpeechLang={handleToggleSpeechLang}
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
