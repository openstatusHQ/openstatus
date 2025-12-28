import { type ReactNode, createContext, useContext, useState } from "react";
import { toast } from "sonner";
import { CodePanelDialog } from "../code-panel-dialog";
import CssImportDialog from "../css-import-dialog";
import { useEditorStore } from "../store/editor-store";
import { parseCssInput } from "../utils/parse-css-input";

interface DialogActionsContextType {
  // Dialog states
  cssImportOpen: boolean;
  codePanelOpen: boolean;

  // Dialog actions
  setCssImportOpen: (open: boolean) => void;
  setCodePanelOpen: (open: boolean) => void;

  // Handler functions
  handleCssImport: (css: string) => void;
}

function useDialogActionsStore(): DialogActionsContextType {
  const [cssImportOpen, setCssImportOpen] = useState(false);
  const [codePanelOpen, setCodePanelOpen] = useState(false);

  const { themeState, setThemeState } = useEditorStore();

  const handleCssImport = (css: string) => {
    const { lightColors, darkColors } = parseCssInput(css);
    const styles = {
      ...themeState.styles,
      light: { ...themeState.styles.light, ...lightColors },
      dark: { ...themeState.styles.dark, ...darkColors },
    };

    setThemeState({
      ...themeState,
      styles,
    });

    toast.success("Your custom CSS has been imported successfully");
  };

  const value = {
    // Dialog states
    cssImportOpen,
    codePanelOpen,

    // Dialog actions
    setCssImportOpen,
    setCodePanelOpen,

    // Handler functions
    handleCssImport,
  };

  return value;
}

export const DialogActionsContext =
  createContext<DialogActionsContextType | null>(null);

export function DialogActionsProvider({ children }: { children: ReactNode }) {
  const { themeState } = useEditorStore();
  const store = useDialogActionsStore();

  return (
    <DialogActionsContext value={store}>
      {children}

      {/* Global Dialogs */}
      <CssImportDialog
        open={store.cssImportOpen}
        onOpenChange={store.setCssImportOpen}
        onImport={store.handleCssImport}
      />
      <CodePanelDialog
        open={store.codePanelOpen}
        onOpenChange={store.setCodePanelOpen}
        themeEditorState={themeState}
      />
    </DialogActionsContext>
  );
}

export function useDialogActions(): DialogActionsContextType {
  const context = useContext(DialogActionsContext);

  if (!context) {
    throw new Error(
      "useDialogActions must be used within a DialogActionsProvider",
    );
  }

  return context;
}
