import { useState } from "react";
import {
  loadCustomization,
  saveCustomization,
  type OnyxAccentTheme,
  type OnyxCustomization,
  type OnyxOrbStyle,
} from "../../lib/customization";
import {
  FrostedGlassToggle,
  SegmentedBar,
  SpeedometerDial,
} from "../common/TelemetryWidgets";

const THEMES: { id: OnyxAccentTheme; label: string; color: string }[] = [
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

  const tokenPercent = Math.round(((cfg.maxTokens - 512) / (4096 - 512)) * 100);
  const tempLabel =
    cfg.temperature <= 0.35
      ? "PRECISION · CODE"
      : cfg.temperature <= 0.75
        ? "BALANCED · SMART"
        : "CREATIVE · WILD";

  return (
    <div className="space-y-3">
      {/* স্পিডোমিটার আর্ক ডায়াল: AI Temperature */}
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

      {/* ২x২ ওয়ার্ম বেন্টো কার্ড + সেগমেন্টেড বার */}
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
                    : "bg-white/[0.06] text-zinc-400 hover:text-white"
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
              Orb Style
            </span>
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--onyx-accent)" }}
            />
          </div>
          <div className="grid grid-cols-1 gap-1.5 pt-1">
            {(["eclipse", "sphere"] as OnyxOrbStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => update({ orbStyle: style })}
                className={`h-8 rounded-xl font-sans text-xs font-medium capitalize transition-all active:scale-95 ${
                  cfg.orbStyle === style
                    ? "onyx-accent-btn"
                    : "bg-white/[0.05] text-zinc-300 hover:bg-white/[0.09]"
                }`}
              >
                {style === "eclipse" ? "Solar Eclipse" : "3D Sphere"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* অ্যাকসেন্ট থিম সিলেক্টর */}
      <div className="onyx-bento-card-subtle rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-sans text-xs font-medium text-zinc-200">
            Accent Theme
          </span>
          <span className="font-mono text-[10px] text-zinc-400 uppercase">
            {cfg.accentTheme}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {THEMES.map((t) => {
            const active = cfg.accentTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => update({ accentTheme: t.id })}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-2 transition-all active:scale-95 ${
                  active
                    ? "border-white/30 bg-white/[0.09]"
                    : "border-white/[0.06] bg-white/[0.02]"
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full"
                  style={{
                    backgroundColor: t.color,
                    boxShadow: active ? `0 0 12px ${t.color}` : "none",
                  }}
                />
                <span className="font-sans text-[10px] font-medium text-zinc-300">
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ফ্রস্টেড গ্লাস টগল সুইচ কন্ট্রোল */}
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

        <div className="h-px bg-white/[0.06]" />

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

      {/* কাস্টম সিস্টেম প্রম্পট */}
      <div className="onyx-bento-card-subtle rounded-2xl p-3.5 space-y-2">
        <label className="block font-sans text-xs font-medium text-zinc-200">
          Custom AI Persona / System Prompt
        </label>
        <textarea
          rows={2}
          value={cfg.customSystemPrompt}
          onChange={(e) => update({ customSystemPrompt: e.target.value })}
          placeholder="e.g. Reply like Jarvis, concise, direct and technical..."
          className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-sans text-xs text-white placeholder:text-zinc-500 focus:border-[var(--onyx-accent)] focus:outline-none"
        />
      </div>
    </div>
  );
}
