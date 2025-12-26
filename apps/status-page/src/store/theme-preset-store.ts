import { create } from "zustand";
import { defaultPresets } from "../components/theme-editor/utils/theme-presets";

export interface ThemePreset {
  label?: string;
  source?: "SAVED" | "BUILT_IN";
  createdAt?: string;
  styles: {
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
}

interface ThemePresetStore {
  presets: Record<string, ThemePreset>;
  getAllPresets: () => Record<string, ThemePreset>;
  getPreset: (id: string) => ThemePreset | undefined;
  loadDefaultPresets: () => void;
  loadSavedPresets: () => void;
  unloadSavedPresets: () => void;
}

export const useThemePresetStore = create<ThemePresetStore>((set, get) => ({
  presets: defaultPresets,
  getAllPresets: () => get().presets,
  getPreset: (id: string) => get().presets[id],
  loadDefaultPresets: () => {
    set({ presets: defaultPresets });
  },
  loadSavedPresets: () => {
    // This would normally fetch saved presets from an API
    // For now, we just keep it empty
  },
  unloadSavedPresets: () => {
    set({ presets: defaultPresets });
  },
}));
