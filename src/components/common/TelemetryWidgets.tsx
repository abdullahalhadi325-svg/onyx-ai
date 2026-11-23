import React from "react";

interface SpeedometerDialProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  sublabel?: string;
  formatValue?: (val: number) => string;
  onChange?: (val: number) => void;
}

export function SpeedometerDial({
  value,
  min,
  max,
  step = 0.05,
  label,
  sublabel,
  formatValue,
  onChange,
}: SpeedometerDialProps) {
  const clamped = Math.min(max, Math.max(min, value));
  const ratio = (clamped - min) / (max - min || 1);
  const radius = 64;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  function adjust(delta: number) {
    if (!onChange) return;
    const next = Math.min(max, Math.max(min, Number((clamped + delta).toFixed(2))));
    onChange(next);
  }

  return (
    <div className="onyx-bento-card flex flex-col items-center rounded-3xl p-4">
      <div className="relative flex h-[108px] w-[170px] items-end justify-center">
        <svg viewBox="0 0 160 95" className="h-full w-full overflow-visible">
          <path
            d="M 16 84 A 64 64 0 0 1 144 84"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M 16 84 A 64 64 0 0 1 144 84"
            fill="none"
            stroke="var(--onyx-accent)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: "stroke-dashoffset 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
              filter: "drop-shadow(0 0 10px rgba(var(--onyx-accent-rgb), 0.65))",
            }}
          />
        </svg>

        <div className="absolute bottom-1 flex flex-col items-center text-center">
          <span className="font-mono text-3xl font-semibold tracking-tight text-white tabular-nums">
            {formatValue ? formatValue(clamped) : clamped}
          </span>
          <span className="font-sans text-[11px] font-medium text-zinc-400">
            {label}
          </span>
        </div>
      </div>

      {sublabel && (
        <p className="mt-1 font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
          {sublabel}
        </p>
      )}

      {onChange && (
        <div className="mt-3 flex w-full items-center gap-2.5">
          <button
            type="button"
            onClick={() => adjust(-step)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] font-mono text-sm text-white active:scale-90 transition-transform"
          >
            -
          </button>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={clamped}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--onyx-accent)]"
          />
          <button
            type="button"
            onClick={() => adjust(step)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] font-mono text-sm text-white active:scale-90 transition-transform"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

interface SegmentedBarProps {
  percent: number;
  segments?: number;
  className?: string;
}

export function SegmentedBar({
  percent,
  segments = 16,
  className = "",
}: SegmentedBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const activeCount = Math.round((clamped / 100) * segments);

  return (
    <div className={`flex items-end gap-[3px] h-5 ${className}`} aria-hidden="true">
      {Array.from({ length: segments }).map((_, idx) => {
        const isActive = idx < activeCount;
        return (
          <span
            key={idx}
            className="flex-1 rounded-full transition-all duration-300"
            style={{
              height: isActive ? "100%" : "68%",
              backgroundColor: isActive
                ? "var(--onyx-accent)"
                : "rgba(255,255,255,0.12)",
              boxShadow: isActive
                ? "0 0 8px rgba(var(--onyx-accent-rgb), 0.45)"
                : "none",
            }}
          />
        );
      })}
    </div>
  );
}

interface FrostedGlassToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}

export function FrostedGlassToggle({
  checked,
  onChange,
  ariaLabel,
}: FrostedGlassToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border border-white/15 bg-[#121216] p-1 transition-colors duration-300 active:scale-95"
      style={{
        boxShadow: checked
          ? "inset 0 0 18px rgba(var(--onyx-accent-rgb), 0.45)"
          : "inset 0 2px 6px rgba(0,0,0,0.7)",
      }}
    >
      <span
        className={`pointer-events-none absolute left-2.5 font-mono text-[9px] font-bold tracking-wider transition-opacity duration-200 ${
          checked ? "text-white opacity-90" : "opacity-0"
        }`}
      >
        ON
      </span>
      <span
        className="relative z-10 flex h-6 w-8 items-center justify-center rounded-full border border-white/30 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: checked ? "translateX(24px)" : "translateX(0px)",
          background: checked
            ? "linear-gradient(135deg, rgba(var(--onyx-accent-rgb), 0.92), rgba(255,255,255,0.28))"
            : "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
          boxShadow: checked
            ? "0 0 14px rgba(var(--onyx-accent-rgb), 0.7), inset 0 1px 0 rgba(255,255,255,0.6)"
            : "inset 0 1px 0 rgba(255,255,255,0.25)",
        }}
      >
        <span className="grid grid-cols-3 gap-[2px] opacity-60">
          <span className="h-[2px] w-[2px] rounded-full bg-white" />
          <span className="h-[2px] w-[2px] rounded-full bg-white" />
          <span className="h-[2px] w-[2px] rounded-full bg-white" />
          <span className="h-[2px] w-[2px] rounded-full bg-white" />
          <span className="h-[2px] w-[2px] rounded-full bg-white" />
          <span className="h-[2px] w-[2px] rounded-full bg-white" />
        </span>
      </span>
    </button>
  );
}
