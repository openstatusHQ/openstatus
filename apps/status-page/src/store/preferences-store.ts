import type { ColorFormat } from "@/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type PackageManager = "pnpm" | "npm" | "yarn" | "bun";
export type ColorSelectorTab = "list" | "palette";

const colorFormatsByVersion = {
  "3": ["hex", "rgb", "hsl"] as const,
  "4": ["hex", "rgb", "hsl"] as const, // "oklch" removed - browser compatibility issues with inline styles
};

interface PreferencesStore {
  // tailwindVersion: "3" | "4"; // Commented out - using v4 only
  colorFormat: ColorFormat;
  colorSelectorTab: ColorSelectorTab;
  // setTailwindVersion: (version: "3" | "4") => void; // Commented out - using v4 only
  setColorFormat: (format: ColorFormat) => void;
  setColorSelectorTab: (tab: ColorSelectorTab) => void;
  getAvailableColorFormats: () => readonly ColorFormat[];
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      // tailwindVersion: "4", // Commented out - using v4 only
      colorFormat: "hex", // Changed from "oklch" to "hex" for browser compatibility
      colorSelectorTab: "list",
      // setTailwindVersion: (version: "3" | "4") => { // Commented out - using v4 only
      //   const currentFormat = get().colorFormat;
      //   // OKLCH handling commented out - no longer supported
      //   // if (version === "3" && currentFormat === "oklch") {
      //   //   set({ tailwindVersion: version, colorFormat: "hsl" });
      //   // } else {
      //   set({ tailwindVersion: version });
      //   // }
      // },
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
        // const version = get().tailwindVersion as "3" | "4"; // Commented out - using v4 only
        const version = "4"; // Hardcoded to v4
        return colorFormatsByVersion[version];
      },
    }),
    {
      name: "preferences-storage", // unique name for localStorage
    },
  ),
);
