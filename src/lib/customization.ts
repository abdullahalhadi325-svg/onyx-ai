export type OnyxAccentTheme = "amber" | "lime" | "cyan" | "crimson";
export type OnyxOrbStyle = "eclipse" | "sphere";
export type OnyxFontScale = "compact" | "default" | "large";

export interface OnyxCustomization {
  accentTheme: OnyxAccentTheme;
  orbStyle: OnyxOrbStyle;
  temperature: number;
  maxTokens: number;
  fontScale: OnyxFontScale;
  ambientGlow: boolean;
  haptics: boolean;
  autoVoiceReply: boolean;
  customSystemPrompt: string;
}

export const DEFAULT_CUSTOMIZATION: OnyxCustomization = {
  accentTheme: "amber",
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
  if (cfg.accentTheme === "amber") {
    root.removeAttribute("data-onyx-theme");
  } else {
    root.setAttribute("data-onyx-theme", cfg.accentTheme);
  }
}
