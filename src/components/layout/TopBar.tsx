import { useEffect, useRef, useState } from 'react';
import {
  Brain,
  CaretDown,
  Check,
  Compass,
  Cpu,
  Detective,
  GlobeHemisphereWest,
  Lightning,
  List,
  UserCircle,
  X,
} from '@phosphor-icons/react';
import type { EngineMode, PersonaId, RoutingModeId } from '../../types/onyx';
import {
  PERSONAS,
  ROUTING_MODES,
  getPersonaOption,
  getRoutingModeOption,
} from '../../utils/onyxState';

interface TopBarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  engineMode: EngineMode;
  onChangeEngineMode: (mode: EngineMode) => void;
  onOpenLocalAIHub: () => void;
  routingMode: RoutingModeId;
  onSelectRoutingMode: (mode: RoutingModeId) => void;
  persona: PersonaId;
  onSelectPersona: (persona: PersonaId) => void;
  isTemporaryChat: boolean;
  onToggleTemporaryChat: () => void;
  onOpenSettings: () => void;
  userInitials: string;
}

function ModeIcon({ id }: { id: RoutingModeId }) {
  switch (id) {
    case 'auto':
      return <Compass size={17} weight="regular" className="shrink-0 text-zinc-300" />;
    case 'flash':
      return <Lightning size={17} weight="regular" className="shrink-0 text-zinc-300" />;
    case 'deep-research':
      return (
        <GlobeHemisphereWest size={17} weight="regular" className="shrink-0 text-zinc-300" />
      );
    case 'deep-think':
      return <Brain size={17} weight="regular" className="shrink-0 text-zinc-300" />;
  }
}

export function TopBar({
  isSidebarOpen,
  onToggleSidebar,
  engineMode,
  onChangeEngineMode,
  onOpenLocalAIHub,
  routingMode,
  onSelectRoutingMode,
  persona,
  onSelectPersona,
  isTemporaryChat,
  onToggleTemporaryChat,
  onOpenSettings,
  userInitials,
}: TopBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPersonaExpanded, setIsPersonaExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeMode = getRoutingModeOption(routingMode);
  const activePersona = getPersonaOption(persona);

  useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  return (
    <header className="fixed top-0 right-0 left-0 z-30 bg-[#000000]/85 px-3 py-2.5 backdrop-blur-md sm:px-4">
      <div
        ref={dropdownRef}
        className="relative mx-auto grid w-full max-w-[760px] grid-cols-[1fr_auto_1fr] items-center gap-2"
      >
        {/* Left: Minimal Animated Sidebar Toggle */}
        <div className="flex items-center justify-start">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? 'Close navigation sidebar' : 'Open navigation sidebar'}
            aria-expanded={isSidebarOpen}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-300 hover:bg-white/[0.07] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/50 transition-transform duration-150"
          >
            <span
              aria-hidden="true"
              className={`absolute flex items-center justify-center transition-[transform,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isSidebarOpen ? 'scale-75 opacity-0' : 'scale-100 opacity-100'
              }`}
            >
              <List size={20} weight="regular" />
            </span>
            <span
              aria-hidden="true"
              className={`absolute flex items-center justify-center transition-[transform,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isSidebarOpen ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
              }`}
            >
              <X size={20} weight="regular" />
            </span>
          </button>
        </div>

        {/* Center: Seamless Model / Engine Switcher Trigger */}
        <div className="flex min-w-0 justify-center">
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="menu"
            className="flex h-10 max-w-[210px] items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-white hover:bg-white/[0.07] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/50 transition-transform duration-150 sm:max-w-none"
          >
            {engineMode === 'local' && (
              <Cpu size={15} weight="fill" className="shrink-0 text-[var(--onyx-accent)]" />
            )}
            <span className="truncate whitespace-nowrap">
              {engineMode === 'local' ? 'Local AI' : activeMode.label}
            </span>
            <CaretDown
              size={13}
              weight="bold"
              className={`shrink-0 text-zinc-400 transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isDropdownOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>
        </div>

        {/* Right: Temporary Chat + Profile Avatar */}
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onToggleTemporaryChat}
            aria-label={isTemporaryChat ? 'Disable temporary chat' : 'Enable temporary chat'}
            aria-pressed={isTemporaryChat}
            title={isTemporaryChat ? 'Temporary chat active' : 'Temporary chat'}
            className={`flex h-10 w-10 items-center justify-center rounded-full active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/50 transition-transform duration-150 ${
              isTemporaryChat
                ? 'bg-blue-500/20 text-blue-200'
                : 'text-zinc-400 hover:bg-white/[0.07] hover:text-white'
            }`}
          >
            <Detective size={18} weight={isTemporaryChat ? 'fill' : 'regular'} />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings and profile"
            className="flex h-9 w-9 items-center justify-center rounded-full onyx-bento-card-subtle font-mono text-xs font-medium text-zinc-200 hover:bg-[#23232D] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/50 transition-transform duration-150"
          >
            {userInitials}
          </button>
        </div>

        {/* Floating Model & Local AI Switcher Menu */}
        <div
          role="menu"
          aria-label="Onyx engine and routing mode"
          aria-hidden={!isDropdownOpen}
          className={`absolute top-13 left-1/2 z-40 w-[min(320px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl bg-[#121217] p-2 shadow-2xl transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isDropdownOpen
              ? 'visible pointer-events-auto translate-y-0 scale-100 opacity-100'
              : 'invisible pointer-events-none -translate-y-2 scale-95 opacity-0'
          }`}
        >
          {/* Cloud Routing Modes */}
          <div className="space-y-0.5">
            {ROUTING_MODES.map((mode) => {
              const isSelected = engineMode === 'cloud' && mode.id === routingMode;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => {
                    onChangeEngineMode('cloud');
                    onSelectRoutingMode(mode.id);
                    setIsDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/40 transition-colors duration-150 ${
                    isSelected
                      ? 'bg-white/[0.09] text-white'
                      : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ModeIcon id={mode.id} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {mode.shortLabel}
                      </div>
                      <div className="truncate text-xs text-zinc-400">
                        {mode.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check size={15} weight="bold" className="shrink-0 text-[var(--onyx-accent)]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Dedicated Local AI Engine Option */}
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={engineMode === 'local'}
              onClick={() => {
                setIsDropdownOpen(false);
                onOpenLocalAIHub();
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/40 transition-colors duration-150 ${
                engineMode === 'local'
                  ? 'onyx-bento-card border-[var(--onyx-accent)]/40 text-white'
                  : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Cpu size={17} weight="regular" className="shrink-0 text-[var(--onyx-accent)]" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    Local AI &amp; GGUF Hub
                  </div>
                  <div className="truncate text-xs text-zinc-400">
                    On-device llama.cpp / PocketPal
                  </div>
                </div>
              </div>
              {engineMode === 'local' ? (
                <Check size={15} weight="bold" className="shrink-0 text-[var(--onyx-accent)]" />
              ) : (
                <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                  Hub
                </span>
              )}
            </button>
          </div>

          {/* Compact Persona Switcher */}
          <div className="mt-1.5 rounded-xl bg-[#0B0B0F] p-1">
            <button
              type="button"
              onClick={() => setIsPersonaExpanded((prev) => !prev)}
              aria-expanded={isPersonaExpanded}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-300 hover:bg-white/[0.05] hover:text-white active:scale-[0.98]"
            >
              <span className="flex items-center gap-2 truncate">
                <UserCircle size={15} weight="regular" className="shrink-0 text-zinc-400" />
                <span className="text-zinc-400">Persona</span>
                <span aria-hidden="true" className="text-zinc-600">
                  ·
                </span>
                <span className="font-mono text-white">{activePersona.name}</span>
              </span>
              <CaretDown
                size={13}
                weight="bold"
                className={`shrink-0 text-zinc-500 transition-transform duration-200 ${
                  isPersonaExpanded ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>

            {isPersonaExpanded && (
              <div className="mt-1 grid grid-cols-2 gap-1 pt-0.5">
                {PERSONAS.map((option) => {
                  const isSelected = option.id === persona;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onSelectPersona(option.id)}
                      className={`flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium active:scale-[0.97] ${
                        isSelected
                          ? 'onyx-bento-card border-[var(--onyx-accent)]/40 text-white'
                          : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <span className="truncate">{option.name}</span>
                      {isSelected && (
                        <Check size={12} weight="bold" className="shrink-0 text-[var(--onyx-accent)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
