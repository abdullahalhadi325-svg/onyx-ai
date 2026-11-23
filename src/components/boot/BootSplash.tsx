import { useEffect, useRef, useState } from 'react';
import { pruneCorruptedOnyxStorage } from '../../lib/artifacts';
import { BACKEND_API_URL } from '../../lib/config';
import { OnyxOrb } from '../common/OnyxOrb';

export type BootTriggerReason = 'launch' | 'login' | 'resume';

interface BootSplashProps {
  isVisible: boolean;
  triggerReason: BootTriggerReason;
  onComplete: () => void;
}

export function BootSplash({
  isVisible,
  triggerReason,
  onComplete,
}: BootSplashProps) {
  const [isExiting, setIsExiting] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    setIsExiting(false);

    // Parallel non-blocking pre-flight storage check & edge warmup (100% silent)
    if (typeof window !== 'undefined' && window.localStorage) {
      pruneCorruptedOnyxStorage(window.localStorage);
    }

    const warmupController = new AbortController();
    const warmupTimeout = window.setTimeout(
      () => warmupController.abort(),
      1150
    );
    void fetch(`${BACKEND_API_URL}/`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: warmupController.signal,
    }).catch(() => undefined);

    // Fast 1.3s silent boot choreography
    const exitTimer = window.setTimeout(() => {
      setIsExiting(true);
    }, 950);

    const completeTimer = window.setTimeout(() => {
      onCompleteRef.current();
    }, 1300);

    return () => {
      window.clearTimeout(warmupTimeout);
      warmupController.abort();
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [isVisible, triggerReason]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Starting Onyx"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#000000] px-6 transition-opacity duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isExiting ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* Centered soft sapphire light bloom */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]" style={{ background: "rgba(var(--onyx-accent-rgb), calc(0.32 * var(--onyx-glow-scale)))" }} data-glow="1 onyx-orb-aura"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[170px] w-[170px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[64px]" style={{ background: "rgba(var(--onyx-accent-rgb), calc(0.2 * var(--onyx-glow-scale)))" }} data-glow="2"
      />

      {/* Silent Animated Onyx Orb Reveal */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="onyx-boot-orb-in">
          <OnyxOrb size="boot" animate />
        </div>
        <div
          style={{ animationDelay: '180ms' }}
          className="mt-6 font-serif text-xl font-medium tracking-tight text-white/95 onyx-fade-up"
        >
          Onyx
        </div>
      </div>
    </div>
  );
}
