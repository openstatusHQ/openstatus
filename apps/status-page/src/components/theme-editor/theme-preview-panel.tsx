"use client";

import { HorizontalScrollArea } from "@/components/horizontal-scroll-area";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useQueryState } from "nuqs";
import { lazy } from "react";
import ColorPreview from "./theme-preview/color-preview";
import ExamplesPreviewContainer from "./theme-preview/examples-preview-container";
import TabsTriggerPill from "./theme-preview/tabs-trigger-pill";
import type { ThemeEditorPreviewProps } from "./types/theme";

const StatusMonitorPlayground = lazy(
  () => import("./theme-preview/status-monitor-playground"),
);

const ThemePreviewPanel = ({
  styles,
  currentMode,
}: ThemeEditorPreviewProps) => {
  const [activeTab, setActiveTab] = useQueryState("p", {
    defaultValue: "status-page",
  });

  if (!styles || !styles[currentMode]) {
    return null;
  }

  return (
    <>
      <div className={cn("flex min-h-0 flex-1 flex-col")}>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <HorizontalScrollArea className="mt-2 mb-1 flex w-full items-center justify-between px-4">
            <TabsList className="inline-flex w-fit items-center justify-center rounded-full bg-background px-0 text-muted-foreground">
              <TabsTriggerPill value="status-page">Status Page</TabsTriggerPill>
              <TabsTriggerPill value="colors">Color Palette</TabsTriggerPill>
            </TabsList>
          </HorizontalScrollArea>

          <section className="relative size-full overflow-hidden p-4 pt-1">
            <div className="relative isolate size-full overflow-hidden rounded-lg border">
              <TabsContent
                value="status-page"
                className="@container m-0 size-full"
              >
                <ExamplesPreviewContainer className="size-full">
                  <div className="p-7.5">
                    <StatusMonitorPlayground />
                  </div>
                </ExamplesPreviewContainer>
              </TabsContent>

              <TabsContent value="colors" className="m-0 size-full">
                <ScrollArea className="size-full">
                  <div className="p-4">
                    <ColorPreview styles={styles} currentMode={currentMode} />
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </section>
        </Tabs>
      </div>
    </>
  );
};

export default ThemePreviewPanel;
