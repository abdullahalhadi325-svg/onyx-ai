import { useEffect, useId, useState } from "react";
import { loadCustomization, type OnyxOrbStyle } from "../../lib/customization";

export type OnyxOrbSize = "boot" | "hero" | "auth" | "mini";

interface OnyxOrbProps {
  size?: OnyxOrbSize;
  animate?: boolean;
  className?: string;
  orbStyle?: OnyxOrbStyle;
}

const SIZE_CONFIG: Record<OnyxOrbSize, { wrapper: string; aura: string }> = {
  boot: { wrapper: "h-36 w-36 sm:h-40 sm:w-40", aura: "-inset-10 blur-3xl" },
  hero: { wrapper: "h-32 w-32 sm:h-36 sm:w-36", aura: "-inset-8 blur-3xl" },
  auth: { wrapper: "h-24 w-24", aura: "-inset-6 blur-2xl" },
  mini: { wrapper: "h-7 w-7", aura: "-inset-1.5 blur-md" },
};

export function OnyxOrb({
  size = "hero",
  animate = true,
  className = "",
  orbStyle,
}: OnyxOrbProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const cfg = SIZE_CONFIG[size];
  const [savedOrb, setSavedOrb] = useState<OnyxOrbStyle>(() => loadCustomization().orbStyle);
  useEffect(() => {
    const sync = () => setSavedOrb(loadCustomization().orbStyle);
    window.addEventListener("onyx-customization-updated", sync);
    return () => window.removeEventListener("onyx-customization-updated", sync);
  }, []);
  const styleMode: OnyxOrbStyle = orbStyle ?? savedOrb;

  const breatheClass = !animate
    ? ""
    : size === "mini"
      ? "onyx-orb-mini-pulse"
      : "onyx-prism-breathe";

  return (
    <div
      aria-hidden="true"
      className={`relative mx-auto flex shrink-0 items-center justify-center select-none ${cfg.wrapper} ${className}`}
    >
      {/* Dynamic Molten Accent Ambient Aura */}
      <div
        className={`pointer-events-none absolute rounded-full ${cfg.aura} ${
          animate ? "onyx-orb-aura" : ""
        }`}
        style={{
          background:
            "radial-gradient(circle, rgba(var(--onyx-accent-rgb), 0.38) 0%, rgba(var(--onyx-accent-rgb), 0.08) 55%, transparent 75%)",
        }}
      />

      <div className={`relative z-10 h-full w-full rounded-full ${breatheClass}`}>
        <svg viewBox="0 0 160 160" className="h-full w-full overflow-visible" fill="none">
          <defs>
            {/* Solar Eclipse Outer Ring Gradient */}
            <linearGradient id={`${uid}-eclipse`} x1="12%" y1="12%" x2="88%" y2="88%">
              <stop offset="0%" stopColor="var(--onyx-accent-soft)" stopOpacity="1" />
              <stop offset="45%" stopColor="var(--onyx-accent)" stopOpacity="0.95" />
              <stop offset="82%" stopColor="var(--onyx-accent)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.85" />
            </linearGradient>

            {/* 3D Molten Sphere Gradient */}
            <radialGradient id={`${uid}-sphere`} cx="36%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#FFF7ED" stopOpacity="0.98" />
              <stop offset="28%" stopColor="var(--onyx-accent-soft)" stopOpacity="0.96" />
              <stop offset="65%" stopColor="var(--onyx-accent)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#090605" stopOpacity="0.98" />
            </radialGradient>

            {/* Inner Eclipse Void */}
            <radialGradient id={`${uid}-void`} cx="50%" cy="50%" r="54%">
              <stop offset="0%" stopColor="#040406" stopOpacity="1" />
              <stop offset="76%" stopColor="#090707" stopOpacity="0.98" />
              <stop offset="100%" stopColor="var(--onyx-accent)" stopOpacity="0.32" />
            </radialGradient>
          </defs>

          {styleMode === "sphere" ? (
            <>
              <circle cx="80" cy="80" r="64" fill={`url(#${uid}-sphere)`} />
              <g className={animate ? "onyx-hud-spin-cw" : ""}>
                <circle
                  cx="80"
                  cy="80"
                  r="72"
                  stroke="var(--onyx-accent-soft)"
                  strokeOpacity="0.35"
                  strokeWidth="1.2"
                  strokeDasharray="28 16 6 16"
                  strokeLinecap="round"
                />
              </g>
            </>
          ) : (
            <>
              {/* Solar Eclipse Glowing Corona Ring */}
              <g className={animate ? "onyx-hud-spin-cw" : ""}>
                <circle
                  cx="80"
                  cy="80"
                  r="64"
                  stroke={`url(#${uid}-eclipse)`}
                  strokeWidth="7.5"
                  style={{
                    filter: "drop-shadow(0 0 12px rgba(var(--onyx-accent-rgb), 0.75))",
                  }}
                />
              </g>

              {/* Dark Obsidian Core */}
              <circle cx="80" cy="80" r="60" fill={`url(#${uid}-void)`} />

              {/* Inner Crisp Specular Rim */}
              <circle
                cx="80"
                cy="80"
                r="60.5"
                stroke="var(--onyx-accent-soft)"
                strokeOpacity="0.55"
                strokeWidth="1.2"
              />

              {/* Subtle Counter-Rotating Precision Telemetry Ticks (Hero & Boot) */}
              {(size === "hero" || size === "boot") && (
                <g className={animate ? "onyx-hud-spin-ccw" : ""}>
                  <circle
                    cx="80"
                    cy="80"
                    r="76"
                    stroke="var(--onyx-accent-soft)"
                    strokeOpacity="0.22"
                    strokeWidth="1"
                    strokeDasharray="2 12"
                  />
                </g>
              )}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
