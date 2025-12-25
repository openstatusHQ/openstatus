"use client";

import { ActionBarButtons } from "./components/action-bar-buttons";
import { HorizontalScrollArea } from "@/components/horizontal-scroll-area";
import { useDialogActions } from "../hooks/use-dialog-actions";

export function ActionBar() {
  const { setCssImportOpen, setCodePanelOpen } = useDialogActions();

  return (
    <div className="border-b">
      <HorizontalScrollArea className="flex h-14 w-full items-center justify-end gap-4 px-4">
        <ActionBarButtons
          onImportClick={() => setCssImportOpen(true)}
          onCodeClick={() => setCodePanelOpen(true)}
        />
      </HorizontalScrollArea>
    </div>
  );
}
