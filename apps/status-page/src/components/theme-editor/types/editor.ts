import type { ThemeStyles } from "./theme";

// Base interface for any editor's state
export interface BaseEditorState {
  styles: ThemeStyles;
}

// Interface for editor-specific controls
// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
export interface EditorControls {
  // Controls can be added per editor type as needed
}

// Interface for editor-specific preview props
export interface EditorPreviewProps {
  styles: ThemeStyles;
}

export interface ThemeEditorState extends BaseEditorState {
  preset?: string;
  styles: ThemeStyles;
  currentMode: "light" | "dark";
  hslAdjustments?: {
    hueShift: number;
    saturationScale: number;
    lightnessScale: number;
  };
}

// Type for available editors
export type EditorType = "button" | "input" | "card" | "dialog" | "theme";

// Interface for editor configuration
export interface EditorConfig {
  type: EditorType;
  name: string;
  description: string;
  defaultState: BaseEditorState;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  controls: React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  preview: React.ComponentType<any>;
}
