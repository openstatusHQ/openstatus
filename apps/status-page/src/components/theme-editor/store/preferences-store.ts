import type { ColorFormat } from "@/components/theme-editor/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ColorSelectorTab = "list" | "palette";

const colorFormatsByVersion = {
  "3": ["hex", "rgb", "hsl"] as const,
  "4": ["hex", "rgb", "hsl", "oklch"] as const,
};

interface PreferencesStore {
  tailwindVersion: "3" | "4";
  colorFormat: ColorFormat;
  colorSelectorTab: ColorSelectorTab;
  setTailwindVersion: (version: "3" | "4") => void;
  setColorFormat: (format: ColorFormat) => void;
  setColorSelectorTab: (tab: ColorSelectorTab) => void;
  getAvailableColorFormats: () => readonly ColorFormat[];
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      tailwindVersion: "4",
      colorFormat: "oklch",
      colorSelectorTab: "list",
      setTailwindVersion: (version: "3" | "4") => {
        const currentFormat = get().colorFormat;
        if (version === "3" && currentFormat === "oklch") {
          set({ tailwindVersion: version, colorFormat: "hsl" });
        } else {
          set({ tailwindVersion: version });
        }
      },
      setColorFormat: (format: ColorFormat) => {
        const availableFormats = get().getAvailableColorFormats();
        if (availableFormats.includes(format)) {
          set({ colorFormat: format });
        }
      },
      setColorSelectorTab: (tab: ColorSelectorTab) => {
        set({ colorSelectorTab: tab });
      },
      getAvailableColorFormats: () => {
        const version = get().tailwindVersion as "3" | "4";
        return colorFormatsByVersion[version];
      },
    }),
    {
      name: "preferences-storage", // unique name for localStorage
    },
  ),
);
