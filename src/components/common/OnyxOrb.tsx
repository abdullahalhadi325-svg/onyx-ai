import { useEffect, useId, useState } from "react";
import { loadCustomization, type OnyxOrbStyle } from "../../lib/customization";

export type OnyxOrbSize = "boot" | "hero" | "auth" | "mini";

interface OnyxOrbProps {
  size?: OnyxOrbSize;
  animate?: boolean;
  className?: string;
  orbStyle?: OnyxOrbStyle;
}

const SIZE_CONFIG: Record<OnyxOrbSize, { wrapper: string; aura: string; coreInset: string }> = {
  boot: { wrapper: "h-36 w-36 sm:h-40 sm:w-40", aura: "-inset-12 blur-3xl", coreInset: "inset-[5px]" },
  hero: { wrapper: "h-32 w-32 sm:h-36 sm:w-36", aura: "-inset-10 blur-3xl", coreInset: "inset-[5px]" },
  auth: { wrapper: "h-24 w-24", aura: "-inset-8 blur-2xl", coreInset: "inset-[4px]" },
  mini: { wrapper: "h-7 w-7", aura: "-inset-1.5 blur-md", coreInset: "inset-[2px]" },
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
  const isLarge = size === "hero" || size === "boot";
  const breatheClass = !animate
    ? ""
    : size === "mini"
      ? "onyx-orb-mini-pulse"
      : "onyx-orb-breathe";

  return (
    <div
      aria-hidden="true"
      className={`relative mx-auto flex shrink-0 items-center justify-center select-none ${cfg.wrapper} ${className}`}
    >
      <div
        className={`pointer-events-none absolute rounded-full ${cfg.aura} ${
          animate ? "onyx-orb-breathe" : ""
        }`}
        style={{
          background:
            "radial-gradient(circle, rgba(var(--onyx-accent-rgb), calc(0.5 * var(--onyx-glow-scale))) 0%, rgba(var(--onyx-accent-rgb), calc(0.14 * var(--onyx-glow-scale))) 46%, transparent 74%)",
        }}
      />

      {animate && isLarge && (
        <div
          className="onyx-orb-pulse-ring pointer-events-none absolute inset-0 rounded-full"
          style={{
            border: "1.5px solid rgba(var(--onyx-accent-rgb), 0.55)",
            boxShadow: "0 0 18px rgba(var(--onyx-accent-rgb), 0.35)",
          }}
        />
      )}

      {styleMode === "sphere" ? (
        <div className={`relative z-10 h-full w-full ${breatheClass}`}>
          <div
            className={`relative h-full w-full overflow-hidden rounded-full ${
              animate ? "onyx-core-morph" : ""
            }`}
            style={{
              background:
                "radial-gradient(circle at 32% 28%, #FFFBF5 0%, var(--onyx-accent-soft) 24%, var(--onyx-accent) 52%, var(--onyx-accent-deep) 78%, #070404 100%)",
              boxShadow:
                "0 0 38px rgba(var(--onyx-accent-rgb), calc(0.58 * var(--onyx-glow-scale))), inset -16px -18px 30px rgba(0, 0, 0, 0.88), inset 6px 6px 18px rgba(255, 255, 255, 0.45)",
            }}
          >
            <div
              className={`pointer-events-none absolute -inset-4 rounded-full opacity-75 mix-blend-screen ${
                animate ? "onyx-orb-spin-slow" : ""
              }`}
              style={{
                background:
                  "conic-gradient(from 40deg, transparent 0deg, rgba(255,255,255,0.65) 55deg, rgba(var(--onyx-accent-rgb), 0.8) 140deg, transparent 220deg, rgba(255,247,237,0.45) 310deg, transparent 360deg)",
                filter: "blur(8px)",
              }}
            />
            <div
              className={`pointer-events-none absolute -inset-2 rounded-full opacity-55 mix-blend-screen ${
                animate ? "onyx-orb-spin-reverse" : ""
              }`}
              style={{
                background:
                  "conic-gradient(from 200deg, transparent 0deg, var(--onyx-accent-soft) 90deg, transparent 190deg, rgba(255,255,255,0.5) 280deg, transparent 360deg)",
                filter: "blur(6px)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 78% 76%, rgba(4, 3, 5, 0.92) 0%, rgba(4, 3, 5, 0.45) 36%, transparent 68%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ border: "1px solid rgba(255, 255, 255, 0.28)" }}
            />
          </div>

          {isLarge && (
            <svg
              viewBox="0 0 160 160"
              className="pointer-events-none absolute -inset-4 h-[calc(100%+32px)] w-[calc(100%+32px)] overflow-visible"
              fill="none"
            >
              <g className={animate ? "onyx-hud-spin-cw" : ""}>
                <circle
                  cx="80"
                  cy="80"
                  r="75"
                  stroke="var(--onyx-accent-soft)"
                  strokeOpacity="0.38"
                  strokeWidth="1.2"
                  strokeDasharray="34 20 8 20"
                  strokeLinecap="round"
                />
              </g>
              <g className={animate ? "onyx-hud-spin-ccw" : ""}>
                <circle
                  id={`${uid}-sphere-hud`}
                  cx="80"
                  cy="80"
                  r="82"
                  stroke="var(--onyx-accent)"
                  strokeOpacity="0.22"
                  strokeWidth="0.9"
                  strokeDasharray="2 10"
                />
              </g>
            </svg>
          )}
        </div>
      ) : (
        <div className={`relative z-10 h-full w-full rounded-full ${breatheClass}`}>
          <div
            className={`pointer-events-none absolute -inset-[4px] ${
              animate ? "onyx-orb-spin-slow onyx-core-morph" : "rounded-full"
            }`}
            style={{
              background:
                "conic-gradient(from 0deg, var(--onyx-accent) 0deg, #FFF7ED 42deg, var(--onyx-accent-soft) 105deg, rgba(var(--onyx-accent-rgb), 0.25) 185deg, var(--onyx-accent) 265deg, #FFE4C4 320deg, var(--onyx-accent) 360deg)",
              filter: size === "mini" ? "blur(1.5px)" : "blur(5px)",
              opacity: 0.96,
            }}
          />

          <div
            className={`pointer-events-none absolute inset-0 rounded-full ${
              animate ? "onyx-orb-spin-reverse" : ""
            }`}
            style={{
              background:
                "conic-gradient(from 180deg, rgba(255,255,255,0.9) 0deg, var(--onyx-accent-soft) 65deg, transparent 150deg, var(--onyx-accent) 240deg, rgba(255,255,255,0.7) 360deg)",
              boxShadow:
                "0 0 32px rgba(var(--onyx-accent-rgb), calc(0.7 * var(--onyx-glow-scale)))",
            }}
          />

          <div
            className={`absolute ${cfg.coreInset} rounded-full bg-[#030305]`}
            style={{
              boxShadow:
                size === "mini"
                  ? "inset 0 0 4px rgba(var(--onyx-accent-rgb), 0.85)"
                  : "inset 0 0 22px rgba(var(--onyx-accent-rgb), 0.7), inset 0 0 5px rgba(255, 255, 255, 0.38)",
            }}
          />

          {isLarge && (
            <svg
              viewBox="0 0 160 160"
              className="pointer-events-none absolute -inset-4 h-[calc(100%+32px)] w-[calc(100%+32px)] overflow-visible"
              fill="none"
            >
              <g className={animate ? "onyx-hud-spin-cw" : ""}>
                <circle
                  cx="80"
                  cy="80"
                  r="74"
                  stroke="var(--onyx-accent-soft)"
                  strokeOpacity="0.34"
                  strokeWidth="1.2"
                  strokeDasharray="28 18 6 18"
                  strokeLinecap="round"
                />
              </g>
              <g className={animate ? "onyx-hud-spin-ccw" : ""}>
                <circle
                  id={`${uid}-eclipse-hud`}
                  cx="80"
                  cy="80"
                  r="82"
                  stroke="var(--onyx-accent)"
                  strokeOpacity="0.24"
                  strokeWidth="0.9"
                  strokeDasharray="2 10"
                />
              </g>
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
