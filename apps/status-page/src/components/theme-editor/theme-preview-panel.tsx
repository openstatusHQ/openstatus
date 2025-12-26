"use client";

// import ShadcnBlocksLogo from "@/assets/shadcnblocks.svg";
import { HorizontalScrollArea } from "@/components/horizontal-scroll-area";
// import { ThemeToggle } from "@/components/theme-toggle";
import { TooltipWrapper } from "@/components/tooltip-wrapper";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MoreVertical } from "lucide-react";
import { useQueryState } from "nuqs";
import ColorPreview from "./theme-preview/color-preview";
import ExamplesPreviewContainer from "./theme-preview/examples-preview-container";
import TabsTriggerPill from "./theme-preview/tabs-trigger-pill";
import type { ThemeEditorPreviewProps } from "./types/theme";

// const DemoCards = lazy(() => import("@/components/examples/cards"));
// const DemoMail = lazy(() => import("@/components/examples/mail"));
// const DemoDashboard = lazy(() => import("@/components/examples/dashboard"));
// const DemoPricing = lazy(() => import("@/components/examples/pricing/pricing"));
// const TypographyDemo = lazy(
//   () => import("@/components/examples/typography/typography-demo"),
// );
// const CustomDemo = lazy(() => import("@/components/examples/custom"));

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

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          // isFullscreen && "bg-background fixed inset-0 z-50",
        )}
      >
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <HorizontalScrollArea className="mt-2 mb-1 flex w-full items-center justify-between px-4">
            <TabsList className="bg-background text-muted-foreground inline-flex w-fit items-center justify-center rounded-full px-0">
              {/* <TabsTriggerPill value="custom">Custom</TabsTriggerPill>
              <TabsTriggerPill value="cards">Cards</TabsTriggerPill> */}

              {/* <div className="hidden md:flex">
                <TabsTriggerPill value="dashboard">Dashboard</TabsTriggerPill>
                <TabsTriggerPill value="mail">Mail</TabsTriggerPill>
              </div>
              <TabsTriggerPill value="pricing">Pricing</TabsTriggerPill> */}
              <TabsTriggerPill value="status-page">Status Page</TabsTriggerPill>
              <TabsTriggerPill value="colors">Color Palette</TabsTriggerPill>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <TooltipWrapper label="More previews" asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical />
                    </Button>
                  </TooltipWrapper>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleTabChange("typography")}
                  >
                    Typography
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TabsList>
          </HorizontalScrollArea>

          <section className="relative size-full overflow-hidden p-4 pt-1">
            <div className="relative isolate size-full overflow-hidden rounded-lg border">
              <TabsContent value="cards" className="m-0 size-full">
                <ExamplesPreviewContainer className="size-full">
                  <ScrollArea className="size-full">
                    {/* <DemoCards /> */}
                  </ScrollArea>
                </ExamplesPreviewContainer>
              </TabsContent>

              <TabsContent
                value="status-page"
                className="@container m-0 size-full"
              >
                <ExamplesPreviewContainer className="size-full">
                  <div>Status Page</div>
                </ExamplesPreviewContainer>
              </TabsContent>

              {/* <TabsContent
                value="dashboard"
                className="@container m-0 size-full"
              >
                <ExamplesPreviewContainer className="size-full">
                  <ScrollArea className="size-full">
                    <div className="size-full min-w-[1400px]">
                      <DemoDashboard />
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </ExamplesPreviewContainer>
              </TabsContent> */}

              {/* <TabsContent
                value="pricing"
                className="@container mt-0 h-full space-y-6"
              >
                <ExamplesPreviewContainer className="size-full">
                  <div className="absolute top-4 right-4 z-10">
                    <Link
                      href="https://shadcnblocks.com?utm_source=tweakcn&utm_medium=theme-editor-preview"
                      target="_blank"
                    >
                      <Button
                        variant="outline"
                        className="group h-12 shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <ShadcnBlocksLogo
                            className="shrink-0"
                            style={{ width: "24px", height: "24px" }}
                          />
                          <div className="text-left">
                            <div className="font-bold">Shadcnblocks.com</div>
                            <div className="text-muted-foreground group-hover:text-accent-foreground text-xs transition-colors">
                              600+ extra shadcn blocks
                            </div>
                          </div>
                        </div>
                      </Button>
                    </Link>
                  </div>
                  <ScrollArea className="size-full">
                    <DemoPricing />
                  </ScrollArea>
                </ExamplesPreviewContainer>
              </TabsContent> */}

              {/* <TabsContent value="mail" className="@container m-0 size-full">
                <ExamplesPreviewContainer className="size-full">
                  <ScrollArea className="size-full">
                    <div className="size-full min-w-[1300px]">
                      <DemoMail />
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </ExamplesPreviewContainer>
              </TabsContent> */}

              {/* <TabsContent value="typography" className="m-0 size-full">
                <ExamplesPreviewContainer className="size-full">
                  <ScrollArea className="size-full">
                    <TypographyDemo />
                  </ScrollArea>
                </ExamplesPreviewContainer>
              </TabsContent> */}

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
