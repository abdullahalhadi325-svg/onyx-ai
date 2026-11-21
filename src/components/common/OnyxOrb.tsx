import { useId } from 'react';

export type OnyxOrbSize = 'boot' | 'hero' | 'auth' | 'mini';

interface OnyxOrbProps {
  size?: OnyxOrbSize;
  animate?: boolean;
  className?: string;
}

const SIZE_CONFIG: Record<
  OnyxOrbSize,
  { wrapper: string; auraOuter: string; auraInner: string }
> = {
  boot: {
    wrapper: 'h-32 w-32 sm:h-36 sm:w-36',
    auraOuter: '-inset-10 bg-[#1D4ED8]/35 blur-3xl',
    auraInner: '-inset-4 bg-[#38BDF8]/22 blur-2xl',
  },
  hero: {
    wrapper: 'h-28 w-28 sm:h-32 sm:w-32',
    auraOuter: '-inset-9 bg-[#1D4ED8]/32 blur-3xl',
    auraInner: '-inset-3 bg-[#38BDF8]/20 blur-xl',
  },
  auth: {
    wrapper: 'h-22 w-22',
    auraOuter: '-inset-7 bg-[#1D4ED8]/30 blur-2xl',
    auraInner: '-inset-2 bg-[#38BDF8]/18 blur-xl',
  },
  mini: {
    wrapper: 'h-7 w-7',
    auraOuter: '-inset-2 bg-[#2563EB]/38 blur-md',
    auraInner: '-inset-0.5 bg-[#38BDF8]/25 blur-sm',
  },
};

export function OnyxOrb({
  size = 'hero',
  animate = true,
  className = '',
}: OnyxOrbProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cfg = SIZE_CONFIG[size];

  const breatheClass = !animate
    ? ''
    : size === 'mini'
      ? 'onyx-orb-mini-pulse'
      : 'onyx-prism-breathe';

  return (
    <div
      aria-hidden="true"
      className={`relative mx-auto flex shrink-0 items-center justify-center select-none ${cfg.wrapper} ${className}`}
    >
      {/* Layered soft ambient sapphire radial aura (compositor-only opacity/scale) */}
      <div
        className={`pointer-events-none absolute rounded-full ${cfg.auraOuter} ${
          animate ? 'onyx-orb-aura' : ''
        }`}
      />
      <div
        className={`pointer-events-none absolute rounded-full ${cfg.auraInner}`}
      />

      {/* Living pure CSS/SVG luminous sapphire energy sphere */}
      <div
        className={`relative z-10 h-full w-full rounded-full ${breatheClass}`}
      >
        <svg
          viewBox="0 0 160 160"
          className="h-full w-full overflow-visible"
          fill="none"
        >
          <defs>
            <clipPath id={`${uid}-clip`}>
              <circle cx="80" cy="80" r="66" />
            </clipPath>

            {/* Dark translucent obsidian-sapphire glass body */}
            <radialGradient id={`${uid}-body`} cx="44%" cy="40%" r="62%">
              <stop offset="0%" stopColor="#050B1C" stopOpacity="0.96" />
              <stop offset="52%" stopColor="#071534" stopOpacity="0.95" />
              <stop offset="82%" stopColor="#123078" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.88" />
            </radialGradient>

            {/* Inner dark void depth so ribbons feel suspended in 3D glass */}
            <radialGradient id={`${uid}-void`} cx="36%" cy="34%" r="54%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.82" />
              <stop offset="70%" stopColor="#020817" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#020817" stopOpacity="0" />
            </radialGradient>

            {/* Subtle indigo-violet subsurface bloom on lower-left curve */}
            <radialGradient id={`${uid}-violet`} cx="28%" cy="76%" r="48%">
              <stop offset="0%" stopColor="#818CF8" stopOpacity="0.42" />
              <stop offset="45%" stopColor="#4F46E5" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0" />
            </radialGradient>

            {/* Electric cerulean-cyan bloom along right crescent */}
            <radialGradient id={`${uid}-cyan-glow`} cx="82%" cy="56%" r="44%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.85" />
              <stop offset="32%" stopColor="#38BDF8" stopOpacity="0.52" />
              <stop offset="70%" stopColor="#2563EB" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0" />
            </radialGradient>

            {/* Primary sweeping silk ribbon gradient */}
            <linearGradient
              id={`${uid}-ribbon-a`}
              x1="12%"
              y1="86%"
              x2="90%"
              y2="16%"
            >
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.12" />
              <stop offset="30%" stopColor="#3B82F6" stopOpacity="0.72" />
              <stop offset="68%" stopColor="#38BDF8" stopOpacity="0.96" />
              <stop offset="90%" stopColor="#F0F9FF" stopOpacity="1" />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.2" />
            </linearGradient>

            {/* Secondary counter-orbit luminous ribbon gradient */}
            <linearGradient
              id={`${uid}-ribbon-b`}
              x1="88%"
              y1="82%"
              x2="14%"
              y2="20%"
            >
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.08" />
              <stop offset="35%" stopColor="#2563EB" stopOpacity="0.55" />
              <stop offset="72%" stopColor="#93C5FD" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#818CF8" stopOpacity="0.18" />
            </linearGradient>

            {/* Crisp outer glass rim */}
            <linearGradient
              id={`${uid}-rim`}
              x1="15%"
              y1="15%"
              x2="88%"
              y2="82%"
            >
              <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.5" />
              <stop offset="46%" stopColor="#38BDF8" stopOpacity="0.92" />
              <stop offset="72%" stopColor="#E0F2FE" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.45" />
            </linearGradient>
          </defs>

          {/* Spherical translucent obsidian-sapphire base */}
          <circle cx="80" cy="80" r="66" fill={`url(#${uid}-body)`} />

          {/* Clipped interior living energy ribbons */}
          <g clipPath={`url(#${uid}-clip)`}>
            <circle cx="80" cy="80" r="66" fill={`url(#${uid}-void)`} />
            <circle cx="80" cy="80" r="66" fill={`url(#${uid}-violet)`} />

            {/* Rotating Layer 1: Primary sweeping sapphire-cyan silk energy ribbons */}
            <g className={animate ? 'onyx-orb-spin-slow' : ''}>
              {/* Soft luminous veil band */}
              <path
                d="M16 106 C46 92, 92 88, 128 46 C144 76, 122 128, 76 138 C46 144, 22 128, 16 106 Z"
                stroke={`url(#${uid}-ribbon-a)`}
                strokeWidth="12"
                strokeOpacity="0.22"
                strokeLinecap="round"
              />
              {/* Mid-density energy sweep */}
              <path
                d="M18 104 C50 86, 98 84, 130 42 C146 76, 118 124, 72 134"
                stroke={`url(#${uid}-ribbon-a)`}
                strokeWidth="4.8"
                strokeOpacity="0.68"
                strokeLinecap="round"
              />
              {/* Razor-bright filament core */}
              <path
                d="M24 106 C56 88, 102 82, 132 44"
                stroke="#E0F2FE"
                strokeWidth="1.9"
                strokeOpacity="0.92"
                strokeLinecap="round"
              />
              {/* Upper subtle orbital fold */}
              <path
                d="M24 54 C46 28, 98 24, 132 52"
                stroke={`url(#${uid}-ribbon-b)`}
                strokeWidth="3.2"
                strokeOpacity="0.52"
                strokeLinecap="round"
              />
            </g>

            {/* Rotating Layer 2: Counter-drifting cobalt & indigo silk arcs */}
            <g className={animate ? 'onyx-orb-spin-reverse' : ''}>
              <path
                d="M22 48 C56 32, 116 40, 136 86 C128 118, 86 140, 44 128"
                stroke={`url(#${uid}-ribbon-b)`}
                strokeWidth="8.5"
                strokeOpacity="0.24"
                strokeLinecap="round"
              />
              <path
                d="M28 116 C64 114, 106 96, 136 62"
                stroke={`url(#${uid}-ribbon-b)`}
                strokeWidth="2.8"
                strokeOpacity="0.78"
                strokeLinecap="round"
              />
              <path
                d="M42 132 C76 122, 118 110, 140 76"
                stroke="#93C5FD"
                strokeWidth="1.5"
                strokeOpacity="0.72"
                strokeLinecap="round"
              />
            </g>

            {/* Floating specular crescent highlight */}
            <g className={animate ? 'onyx-orb-ribbon-drift' : ''}>
              <circle cx="80" cy="80" r="66" fill={`url(#${uid}-cyan-glow)`} />
              <path
                d="M114 34 C138 54, 144 90, 122 118"
                stroke="#E0F2FE"
                strokeWidth="2.6"
                strokeOpacity="0.88"
                strokeLinecap="round"
              />
              <path
                d="M34 116 C46 130, 68 138, 90 136"
                stroke="#A5B4FC"
                strokeWidth="1.6"
                strokeOpacity="0.6"
                strokeLinecap="round"
              />
            </g>
          </g>

          {/* Crisp luminous glass sphere rim */}
          <circle
            cx="80"
            cy="80"
            r="66"
            stroke={`url(#${uid}-rim)`}
            strokeWidth="1.6"
          />
          <circle
            cx="80"
            cy="80"
            r="64.5"
            stroke="#FFFFFF"
            strokeOpacity="0.12"
            strokeWidth="0.75"
          />
        </svg>
      </div>
    </div>
  );
}
