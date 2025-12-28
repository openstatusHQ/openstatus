import { Separator } from "@/components/ui/separator";
import { useEditorStore } from "../../store/editor-store";
import { CodeButton } from "./code-button";
import { ImportButton } from "./import-button";
import { MoreOptions } from "./more-options";
import { ResetButton } from "./reset-button";
import { ThemeToggle } from "./theme-toggle";
import { UndoRedoButtons } from "./undo-redo-buttons";

interface ActionBarButtonsProps {
  onImportClick: () => void;
  onCodeClick: () => void;
}

export function ActionBarButtons({
  onImportClick,
  onCodeClick,
}: ActionBarButtonsProps) {
  const { resetToCurrentPreset, hasUnsavedChanges } = useEditorStore();

  const handleReset = () => {
    resetToCurrentPreset();
  };

  return (
    <div className="flex items-center gap-1">
      <MoreOptions />
      <Separator orientation="vertical" className="mx-1 h-8" />
      <ThemeToggle />
      <Separator orientation="vertical" className="mx-1 h-8" />
      <UndoRedoButtons />
      <Separator orientation="vertical" className="mx-1 h-8" />
      <ResetButton onClick={handleReset} disabled={!hasUnsavedChanges()} />
      <div className="hidden items-center gap-1 md:flex">
        <ImportButton onClick={onImportClick} />
      </div>
      <Separator orientation="vertical" className="mx-1 h-8" />
      <CodeButton onClick={onCodeClick} />
    </div>
  );
}
