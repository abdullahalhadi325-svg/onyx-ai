import { useEffect, useState } from 'react';
import {
  Cpu,
  GearSix,
  MagnifyingGlass,
  Plus,
  X,
} from '@phosphor-icons/react';
import { OnyxOrb } from '../common/OnyxOrb';
import type { ChatSession, EngineMode, OnyxUserProfile } from '../../types/onyx';
import { filterChats } from '../../utils/onyxState';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chats: ChatSession[];
  isLoadingChats?: boolean;
  activeChatId: string | null;
  engineMode: EngineMode;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onOpenLocalAIHub: () => void;
  onOpenSettings: () => void;
  userProfile: OnyxUserProfile;
}

export function Sidebar({
  isOpen,
  onClose,
  chats,
  isLoadingChats = false,
  activeChatId,
  engineMode,
  onSelectChat,
  onNewChat,
  onOpenLocalAIHub,
  onOpenSettings,
  userProfile,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const filteredChats = filterChats(chats, searchQuery);

  // Detect mobile virtual keyboard so the footer never crushes Recent Chats
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.visualViewport) {
      setIsKeyboardOpen(false);
      return;
    }

    const viewport = window.visualViewport;
    const checkViewport = () => {
      const heightRatio = viewport.height / window.innerHeight;
      setIsKeyboardOpen(heightRatio < 0.74 || viewport.height < 480);
    };

    checkViewport();
    viewport.addEventListener('resize', checkViewport);
    return () => viewport.removeEventListener('resize', checkViewport);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsSearchFocused(false);
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const hideFooterForKeyboard = isKeyboardOpen || isSearchFocused;

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 transition-opacity duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isOpen
          ? 'visible pointer-events-auto opacity-100'
          : 'invisible pointer-events-none opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#000000]/75 backdrop-blur-sm"
      />

      {/* Seamless Obsidian Slide-Over Drawer (flat opaque surface for 60fps mobile scrolling) */}
      <aside
        aria-label="Onyx navigation"
        className={`relative flex h-full w-[min(308px,86vw)] flex-col overflow-hidden bg-[#09090B] shadow-2xl transition-[transform,opacity] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
        }`}
      >
        {/* 1. Clean Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <OnyxOrb size="mini" animate={false} />
            <span className="font-serif text-lg font-medium tracking-tight text-white">
              Onyx
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-white/[0.07] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/50 transition-transform duration-150"
          >
            <X size={18} weight="regular" />
          </button>
        </div>

        {/* 2. + New Chat Pill, Dedicated Local AI Button & Search Chats */}
        <div className="shrink-0 space-y-2.5 px-4 pb-3">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full onyx-accent-btn px-4 font-sans text-sm font-medium text-white shadow-md shadow-blue-600/20  active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 transition-transform duration-150"
          >
            <Plus size={16} weight="bold" />
            <span>New Chat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLocalAIHub();
            }}
            className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl px-3.5 font-sans text-sm font-medium active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/50 transition-colors duration-150 ${
              engineMode === 'local'
                ? 'onyx-bento-card border-[var(--onyx-accent)]/40 text-white'
                : 'onyx-bento-card-subtle text-zinc-200 hover:bg-[#191920]'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Cpu size={17} weight="regular" className="text-[var(--onyx-accent)]" />
              <span>Local AI</span>
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                engineMode === 'local'
                  ? 'bg-blue-500/30 text-blue-200'
                  : 'bg-white/[0.06] text-zinc-400'
              }`}
            >
              {engineMode === 'local' ? 'Active' : 'GGUF Hub'}
            </span>
          </button>

          <div className="relative">
            <label htmlFor="onyx-sidebar-search" className="sr-only">
              Search chats
            </label>
            <MagnifyingGlass
              size={15}
              weight="regular"
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-500"
            />
            <input
              id="onyx-sidebar-search"
              type="search"
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search chats"
              className="h-10 w-full rounded-xl onyx-bento-card-subtle py-2 pr-9 pl-9 font-sans text-sm text-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
                className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[0.08] hover:text-white active:scale-[0.96]"
              >
                <X size={13} weight="bold" />
              </button>
            )}
          </div>
        </div>

        {/* 3. Scrollable Recent Chats (100% real user history — zero demo chats) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <h2 className="font-sans text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
              Recent Chats
            </h2>
            <span className="font-mono text-[11px] text-zinc-600 tabular-nums">
              {filteredChats.length}
            </span>
          </div>

          {isLoadingChats ? (
            <div className="space-y-1.5 px-1 animate-pulse">
              <div className="h-10 rounded-xl bg-white/[0.04]" />
              <div className="h-10 rounded-xl bg-white/[0.04]" />
              <div className="h-10 rounded-xl bg-white/[0.04]" />
            </div>
          ) : filteredChats.length === 0 ? (
            <p className="px-2 py-4 font-sans text-xs leading-relaxed text-zinc-500">
              {searchQuery
                ? `No chats match "${searchQuery}".`
                : 'Your conversations will appear here and stay saved automatically.'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filteredChats.map((chat) => {
                const isActive = chat.id === activeChatId;
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => {
                      onSelectChat(chat.id);
                      onClose();
                    }}
                    className={`onyx-bento-card-subtle mb-1.5 flex min-h-[48px] w-full items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-left active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/40 transition-colors duration-150 ${
                      isActive
                        ? 'bg-white/[0.09] text-white'
                        : 'text-zinc-300 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <span className="truncate font-sans text-sm">
                      {chat.title}
                    </span>
                    <span className="shrink-0 font-sans text-[11px] text-zinc-500 tabular-nums">
                      {chat.updatedAt}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Compact 1-Row Footer + Tiny Credit */}
        {!hideFooterForKeyboard && (
          <div className="shrink-0 px-3 pt-2 pb-3">
            <div className="flex items-center justify-between gap-2 rounded-2xl onyx-bento-card-subtle p-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 text-left hover:bg-white/[0.04] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/40 transition-transform duration-150"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1F2230] font-sans text-xs font-medium text-white">
                  {userProfile.initials}
                </div>
                <span className="truncate font-sans text-sm font-medium text-white">
                  {userProfile.displayName}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                aria-label="Open settings"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/[0.07] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/40 transition-transform duration-150"
              >
                <GearSix size={18} weight="regular" />
              </button>
            </div>

            <p className="mt-2 text-center font-sans text-[11px] text-zinc-500/80">
              Onyx • Abdullah Al Hadi
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
