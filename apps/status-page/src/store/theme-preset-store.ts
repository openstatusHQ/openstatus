import { create } from "zustand";

export interface ThemePreset {
  id: string;
  label: string;
  source: "SAVED" | "DEFAULT";
  createdAt?: string;
  styles?: {
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
}

interface ThemePresetStore {
  presets: Record<string, ThemePreset>;
  getAllPresets: () => Record<string, ThemePreset>;
  getPreset: (id: string) => ThemePreset | undefined;
  loadSavedPresets: () => void;
  unloadSavedPresets: () => void;
}

export const useThemePresetStore = create<ThemePresetStore>((set, get) => ({
  presets: {},
  getAllPresets: () => get().presets,
  getPreset: (id: string) => get().presets[id],
  loadSavedPresets: () => {
    // This would normally fetch saved presets from an API
    // For now, we just keep it empty
  },
  unloadSavedPresets: () => {
    set({ presets: {} });
  },
}));

