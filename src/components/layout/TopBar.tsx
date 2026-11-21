import { useEffect, useRef, useState } from 'react';
import {
  Brain,
  CaretDown,
  Check,
  Compass,
  Detective,
  GlobeHemisphereWest,
  Lightning,
  List,
  UserCircle,
  X,
} from '@phosphor-icons/react';
import type { PersonaId, RoutingModeId } from '../../types/onyx';
import {
  PERSONAS,
  ROUTING_MODES,
  getPersonaOption,
  getRoutingModeOption,
} from '../../utils/onyxState';

interface TopBarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
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
      return <Compass size={18} weight="regular" className="shrink-0 text-white/80" />;
    case 'flash':
      return <Lightning size={18} weight="regular" className="shrink-0 text-white/80" />;
    case 'deep-research':
      return (
        <GlobeHemisphereWest size={18} weight="regular" className="shrink-0 text-white/80" />
      );
    case 'deep-think':
      return <Brain size={18} weight="regular" className="shrink-0 text-white/80" />;
  }
}

export function TopBar({
  isSidebarOpen,
  onToggleSidebar,
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
    <header className="fixed top-0 left-0 right-0 z-30 px-3 pt-3 sm:px-4 pointer-events-none">
      {/* Flat top-edge mask preventing scrolled content from peeking above the floating bar */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 right-0 left-0 h-3 bg-[#000000]"
      />
      <div
        ref={dropdownRef}
        className="pointer-events-auto relative mx-auto grid w-full max-w-[760px] grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#181818]/80 p-1 backdrop-blur-xl"
      >
        {/* Left: Animated menu toggle button */}
        <div className="flex items-center justify-start">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? 'Close navigation sidebar' : 'Open navigation sidebar'}
            aria-expanded={isSidebarOpen}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/85 hover:bg-[#313131] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          >
            <span
              aria-hidden="true"
              className={`absolute flex items-center justify-center transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isSidebarOpen ? 'scale-75 opacity-0' : 'scale-100 opacity-100'
              }`}
            >
              <List size={20} weight="regular" />
            </span>
            <span
              aria-hidden="true"
              className={`absolute flex items-center justify-center transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isSidebarOpen ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
              }`}
            >
              <X size={20} weight="regular" />
            </span>
          </button>
        </div>

        {/* Center: Onyx Routing Mode Trigger */}
        <div className="flex min-w-0 justify-center">
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="menu"
            className="flex h-11 max-w-[190px] items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-white hover:bg-[#313131] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-none sm:px-3"
          >
            <span className="truncate whitespace-nowrap">{activeMode.label}</span>
            <CaretDown
              size={14}
              weight="bold"
              className={`shrink-0 text-white/60 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isDropdownOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>
        </div>

        {/* Right: Temporary Chat toggle + Profile avatar */}
        <div className="flex shrink-0 items-center justify-end gap-1">
          <button
            type="button"
            onClick={onToggleTemporaryChat}
            aria-label={isTemporaryChat ? 'Disable temporary chat' : 'Enable temporary chat'}
            aria-pressed={isTemporaryChat}
            title={isTemporaryChat ? 'Temporary chat active' : 'Temporary chat'}
            className={`flex h-11 w-11 items-center justify-center rounded-xl active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isTemporaryChat
                ? 'border border-white/[0.16] bg-[#272727] text-white'
                : 'text-white/70 hover:bg-[#313131] hover:text-white'
            }`}
          >
            <Detective size={19} weight={isTemporaryChat ? 'fill' : 'regular'} />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings and profile"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-[#272727] text-xs font-mono font-medium text-white hover:bg-[#313131] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          >
            {userInitials}
          </button>
        </div>

        {/* Floating Routing Mode Menu centered to the TopBar */}
        <div
          role="menu"
          aria-label="Onyx routing mode and persona"
          aria-hidden={!isDropdownOpen}
          className={`absolute top-15 left-1/2 z-40 w-[min(320px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border border-white/[0.08] bg-[#1F1F1F] p-2 shadow-2xl transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isDropdownOpen
              ? 'visible pointer-events-auto translate-y-0 scale-100 opacity-100'
              : 'invisible pointer-events-none -translate-y-2 scale-95 opacity-0'
          }`}
        >
          <div className="space-y-1">
            {ROUTING_MODES.map((mode) => {
              const isSelected = mode.id === routingMode;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => {
                    onSelectRoutingMode(mode.id);
                    setIsDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isSelected
                      ? 'border border-white/[0.08] bg-[#272727] text-white'
                      : 'text-white/85 hover:bg-[#313131]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ModeIcon id={mode.id} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {mode.shortLabel}
                      </div>
                      <div className="truncate text-xs text-white/55">
                        {mode.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check size={16} weight="bold" className="shrink-0 text-white" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Expandable Persona Selector */}
          <div className="mt-2 rounded-xl border border-white/[0.08] bg-[#181818] p-1">
            <button
              type="button"
              onClick={() => setIsPersonaExpanded((prev) => !prev)}
              aria-expanded={isPersonaExpanded}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-white/80 hover:bg-[#313131] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
              <span className="flex items-center gap-2 truncate">
                <UserCircle size={16} weight="regular" className="shrink-0 text-white/65" />
                <span className="font-medium text-white/70">Persona</span>
                <span aria-hidden="true" className="text-white/35">
                  ·
                </span>
                <span className="font-mono text-white">{activePersona.name}</span>
              </span>
              <CaretDown
                size={14}
                weight="bold"
                className={`shrink-0 text-white/55 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isPersonaExpanded ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>

            {isPersonaExpanded && (
              <div className="mt-1 grid grid-cols-2 gap-1 pt-1">
                {PERSONAS.map((option) => {
                  const isSelected = option.id === persona;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onSelectPersona(option.id);
                      }}
                      className={`flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isSelected
                          ? 'border border-white/[0.08] bg-[#272727] text-white'
                          : 'text-white/70 hover:bg-[#313131] hover:text-white'
                      }`}
                    >
                      <span className="truncate">{option.name}</span>
                      {isSelected && (
                        <Check size={13} weight="bold" className="shrink-0 text-white" />
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
