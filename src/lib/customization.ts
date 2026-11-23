export type OnyxAccentTheme = "amber" | "lime" | "cyan" | "crimson" | "custom";
export type OnyxOrbStyle = "eclipse" | "sphere";
export type OnyxFontScale = "compact" | "default" | "large";

export interface OnyxCustomization {
  accentTheme: OnyxAccentTheme;
  accentHue: number;
  glowIntensity: number;
  glassOpacity: number;
  orbStyle: OnyxOrbStyle;
  temperature: number;
  maxTokens: number;
  fontScale: OnyxFontScale;
  ambientGlow: boolean;
  haptics: boolean;
  autoVoiceReply: boolean;
  customSystemPrompt: string;
}

export const PRESET_HUES: Record<Exclude<OnyxAccentTheme, "custom">, number> = {
  amber: 25,
  lime: 84,
  cyan: 199,
  crimson: 348,
};

export const DEFAULT_CUSTOMIZATION: OnyxCustomization = {
  accentTheme: "amber",
  accentHue: 25,
  glowIntensity: 75,
  glassOpacity: 65,
  orbStyle: "eclipse",
  temperature: 0.65,
  maxTokens: 2048,
  fontScale: "default",
  ambientGlow: true,
  haptics: true,
  autoVoiceReply: false,
  customSystemPrompt: "",
};

const STORAGE_KEY = "onyx_pro_customization_v1";

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

export function loadCustomization(): OnyxCustomization {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOMIZATION;
    const parsed = JSON.parse(raw) as Partial<OnyxCustomization>;
    return { ...DEFAULT_CUSTOMIZATION, ...parsed };
  } catch {
    return DEFAULT_CUSTOMIZATION;
  }
}

export function saveCustomization(next: OnyxCustomization): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    applyCustomizationToDom(next);
    window.dispatchEvent(new Event("onyx-customization-updated"));
  } catch {}
}

export function applyCustomizationToDom(cfg: OnyxCustomization): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const hue =
    cfg.accentTheme === "custom"
      ? cfg.accentHue
      : PRESET_HUES[cfg.accentTheme] ?? cfg.accentHue;

  const sat = cfg.accentTheme === "lime" ? 85 : 95;
  const light = cfg.accentTheme === "lime" ? 66 : 54;
  const [r, g, b] = hslToRgb(hue, sat, light);

  root.style.setProperty("--onyx-accent", `hsl(${hue}, ${sat}%, ${light}%)`);
  root.style.setProperty("--onyx-accent-soft", `hsl(${hue}, ${sat}%, ${Math.min(82, light + 16)}%)`);
  root.style.setProperty("--onyx-accent-deep", `hsl(${hue}, ${sat}%, ${Math.max(24, light - 22)}%)`);
  root.style.setProperty("--onyx-accent-rgb", `${r}, ${g}, ${b}`);
  root.style.setProperty("--onyx-glow-scale", String((cfg.glowIntensity ?? 75) / 100));
  root.style.setProperty("--onyx-glass-alpha", String(0.45 + ((cfg.glassOpacity ?? 65) / 100) * 0.4));

  const fontPx = cfg.fontScale === "compact" ? "14.5px" : cfg.fontScale === "large" ? "17px" : "15.5px";
  root.style.setProperty("--onyx-font-base", fontPx);
}
