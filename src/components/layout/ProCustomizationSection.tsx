import { useState } from "react";
import {
  DEFAULT_CUSTOMIZATION,
  PRESET_HUES,
  loadCustomization,
  saveCustomization,
  type OnyxAccentTheme,
  type OnyxCustomization,
  type OnyxFontScale,
  type OnyxOrbStyle,
} from "../../lib/customization";
import {
  FrostedGlassToggle,
  SegmentedBar,
  SpeedometerDial,
} from "../common/TelemetryWidgets";

const THEMES: { id: Exclude<OnyxAccentTheme, "custom">; label: string; color: string }[] = [
  { id: "amber", label: "Amber", color: "#F97316" },
  { id: "lime", label: "Lime", color: "#BEF264" },
  { id: "cyan", label: "Cyan", color: "#38BDF8" },
  { id: "crimson", label: "Crimson", color: "#F43F5E" },
];

export function ProCustomizationSection() {
  const [cfg, setCfg] = useState<OnyxCustomization>(() => loadCustomization());

  function update(patch: Partial<OnyxCustomization>) {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      saveCustomization(next);
      return next;
    });
  }

  function resetAll() {
    setCfg(DEFAULT_CUSTOMIZATION);
    saveCustomization(DEFAULT_CUSTOMIZATION);
  }

  const tokenPercent = Math.round(((cfg.maxTokens - 512) / (4096 - 512)) * 100);
  const tempLabel =
    cfg.temperature <= 0.35
      ? "PRECISION · CODE"
      : cfg.temperature <= 0.75
        ? "BALANCED · SMART"
        : "CREATIVE · WILD";

  return (
    <div className="space-y-3">
      {/* ১. স্পিডোমিটার আর্ক ডায়াল: AI Temperature */}
      <SpeedometerDial
        value={cfg.temperature}
        min={0}
        max={1}
        step={0.05}
        label="AI Temperature"
        sublabel={tempLabel}
        formatValue={(v) => v.toFixed(2)}
        onChange={(v) => update({ temperature: v })}
      />

      {/* ২. ২x২ ওয়ার্ম বেন্টো কার্ড: Max Tokens + Orb Style */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="onyx-bento-card rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-zinc-400 uppercase">
              Max Tokens
            </span>
            <span className="font-mono text-xs font-semibold text-white">
              {cfg.maxTokens}
            </span>
          </div>
          <SegmentedBar percent={tokenPercent} segments={12} />
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            {[1024, 2048, 4096].map((tk) => (
              <button
                key={tk}
                type="button"
                onClick={() => update({ maxTokens: tk })}
                className={`flex-1 rounded-lg py-1 font-mono text-[10px] font-medium transition-all active:scale-95 ${
                  cfg.maxTokens === tk
                    ? "onyx-accent-btn"
                    : "onyx-glass-btn text-zinc-300 hover:text-white"
                }`}
              >
                {tk >= 1024 ? `${tk / 1024}K` : tk}
              </button>
            ))}
          </div>
        </div>

        <div className="onyx-bento-card rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-zinc-400 uppercase">
              Orb Core
            </span>
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: "var(--onyx-accent)",
                boxShadow: "0 0 8px rgba(var(--onyx-accent-rgb), 0.9)",
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-1.5 pt-1">
            {(["eclipse", "sphere"] as OnyxOrbStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => update({ orbStyle: style })}
                className={`h-8 rounded-xl font-sans text-xs font-medium transition-all active:scale-95 ${
                  cfg.orbStyle === style
                    ? "onyx-accent-btn"
                    : "onyx-glass-btn text-zinc-200 hover:text-white"
                }`}
              >
                {style === "eclipse" ? "Solar Eclipse" : "3D Plasma"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ৩. লাইভ কালার হিউ স্লাইডার + প্রিসেট থিম */}
      <div className="onyx-bento-card rounded-2xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-sans text-xs font-semibold text-white">
            Accent Color & Hue
          </span>
          <span className="font-mono text-[10px] text-zinc-300 uppercase">
            {cfg.accentTheme === "custom" ? `HUE ${cfg.accentHue}°` : cfg.accentTheme}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {THEMES.map((t) => {
            const active = cfg.accentTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  update({ accentTheme: t.id, accentHue: PRESET_HUES[t.id] })
                }
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-2 transition-all active:scale-95 ${
                  active
                    ? "border-white/35 bg-white/[0.12]"
                    : "onyx-glass-btn border-white/[0.08]"
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full"
                  style={{
                    backgroundColor: t.color,
                    boxShadow: active ? `0 0 12px ${t.color}` : "none",
                  }}
                />
                <span className="font-sans text-[10px] font-medium text-zinc-200">
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 0-360 Rainbow Hue Slider */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
            <span>CUSTOM SPECTRUM</span>
            <span className="text-white">{cfg.accentHue}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={cfg.accentHue}
            onChange={(e) =>
              update({ accentTheme: "custom", accentHue: Number(e.target.value) })
            }
            className="onyx-hue-slider h-2.5 w-full cursor-pointer appearance-none rounded-full border border-white/20"
          />
        </div>
      </div>

      {/* ৪. গ্লো ইনটেনসিটি + গ্লাস ডেপথ স্লাইডার */}
      <div className="onyx-bento-card-subtle rounded-2xl p-3.5 space-y-3.5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs font-medium text-zinc-200">
              Glow Intensity
            </span>
            <span className="font-mono text-[11px] text-zinc-300">
              {cfg.glowIntensity}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={cfg.glowIntensity}
            onChange={(e) => update({ glowIntensity: Number(e.target.value) })}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--onyx-accent)]"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs font-medium text-zinc-200">
              Frosted Glass Depth
            </span>
            <span className="font-mono text-[11px] text-zinc-300">
              {cfg.glassOpacity}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={cfg.glassOpacity}
            onChange={(e) => update({ glassOpacity: Number(e.target.value) })}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--onyx-accent)]"
          />
        </div>

        {/* ফন্ট সাইজ স্কেল */}
        <div className="space-y-1.5 pt-1">
          <span className="block font-sans text-xs font-medium text-zinc-200">
            Text Size
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(["compact", "default", "large"] as OnyxFontScale[]).map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => update({ fontScale: sc })}
                className={`h-8 rounded-xl font-sans text-xs font-medium capitalize transition-all active:scale-95 ${
                  cfg.fontScale === sc
                    ? "onyx-accent-btn"
                    : "onyx-glass-btn text-zinc-300 hover:text-white"
                }`}
              >
                {sc}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ৫. ফ্রস্টেড গ্লাস টগল সুইচ কন্ট্রোল */}
      <div className="onyx-bento-card-subtle rounded-2xl p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-sans text-xs font-medium text-white">
              Ambient Edge Glow
            </p>
            <p className="font-sans text-[11px] text-zinc-400">
              Warm directional lighting on home
            </p>
          </div>
          <FrostedGlassToggle
            checked={cfg.ambientGlow}
            onChange={(v) => update({ ambientGlow: v })}
            ariaLabel="Toggle Ambient Edge Glow"
          />
        </div>

        <div className="h-px bg-white/[0.07]" />

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-sans text-xs font-medium text-white">
              Haptic Vibration
            </p>
            <p className="font-sans text-[11px] text-zinc-400">
              Tactile feedback on controls
            </p>
          </div>
          <FrostedGlassToggle
            checked={cfg.haptics}
            onChange={(v) => update({ haptics: v })}
            ariaLabel="Toggle Haptic Feedback"
          />
        </div>

        <div className="h-px bg-white/[0.07]" />

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-sans text-xs font-medium text-white">
              Auto-Voice Reply
            </p>
            <p className="font-sans text-[11px] text-zinc-400">
              Speak AI responses automatically
            </p>
          </div>
          <FrostedGlassToggle
            checked={cfg.autoVoiceReply}
            onChange={(v) => update({ autoVoiceReply: v })}
            ariaLabel="Toggle Auto-Voice Reply"
          />
        </div>
      </div>

      {/* ৬. কাস্টম সিস্টেম প্রম্পট + রিসেট */}
      <div className="onyx-bento-card-subtle rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="font-sans text-xs font-medium text-zinc-200">
            Custom AI Persona / System Prompt
          </label>
          <button
            type="button"
            onClick={resetAll}
            className="onyx-glass-btn rounded-lg px-2.5 py-1 font-mono text-[10px] text-zinc-300 hover:text-white"
          >
            RESET
          </button>
        </div>
        <textarea
          rows={2}
          value={cfg.customSystemPrompt}
          onChange={(e) => update({ customSystemPrompt: e.target.value })}
          placeholder="e.g. Reply like Jarvis, concise, direct and technical..."
          className="w-full resize-none rounded-xl border border-white/15 bg-black/45 px-3 py-2 font-sans text-xs text-white placeholder:text-zinc-500 focus:border-[var(--onyx-accent)] focus:outline-none"
        />
      </div>
    </div>
  );
}
