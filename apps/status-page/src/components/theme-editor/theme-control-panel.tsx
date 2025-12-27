"use client";

import React, { useState } from "react";

import { HorizontalScrollArea } from "@/components/horizontal-scroll-area";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import ColorPicker from "./color-picker";
import {
  COMMON_STYLES,
  defaultThemeState,
  openstatusCommonStyles,
} from "./config/theme";
import ControlSection from "./control-section";
import HslAdjustmentControls from "./hsl-adjustment-controls";
import ShadowControl from "./shadow-control";
import { SliderWithInput } from "./slider-with-input";
import ThemePresetSelect from "./theme-preset-select";
import TabsTriggerPill from "./theme-preview/tabs-trigger-pill";
import type { ThemeEditorControlsProps, ThemeStyleProps } from "./types/theme";

type ControlTab = "colors" | "typography" | "other" | "openstatus";

const ThemeControlPanel = ({
  styles,
  currentMode,
  onChange,
}: ThemeEditorControlsProps) => {
  const [tab, setTab] = useState<ControlTab>("openstatus");

  const currentStyles = React.useMemo(
    () => ({
      ...defaultThemeState.styles[currentMode],
      ...openstatusCommonStyles?.[currentMode],
      ...styles?.[currentMode],
    }),
    [currentMode, styles],
  );

  const updateStyle = React.useCallback(
    <K extends keyof typeof currentStyles>(
      key: K,
      value: (typeof currentStyles)[K],
    ) => {
      // apply common styles to both light and dark modes
      if (COMMON_STYLES.includes(key)) {
        onChange({
          ...styles,
          light: { ...styles.light, [key]: value },
          dark: { ...styles.dark, [key]: value },
        });
        return;
      }

      onChange({
        ...styles,
        [currentMode]: {
          ...currentStyles,
          [key]: value,
        },
      });
    },
    [onChange, styles, currentMode, currentStyles],
  );

  // Ensure we have valid styles for the current mode
  if (!currentStyles) {
    return null; // Or some fallback UI
  }

  const radius = Number.parseFloat(currentStyles.radius?.replace("rem", ""));

  return (
    <>
      <div className="border-b">
        <ThemePresetSelect className="h-14 rounded-none" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col space-y-4">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as ControlTab)}
          className="flex min-h-0 w-full flex-1 flex-col"
        >
          <HorizontalScrollArea className="mt-2 mb-1 px-4">
            <TabsList className="bg-background text-muted-foreground inline-flex w-fit items-center justify-center rounded-full px-0">
              <TabsTriggerPill value="openstatus">Openstatus</TabsTriggerPill>
              <TabsTriggerPill value="colors">Colors</TabsTriggerPill>
              <TabsTriggerPill value="typography">Typography</TabsTriggerPill>
              <TabsTriggerPill value="other">Other</TabsTriggerPill>
            </TabsList>
          </HorizontalScrollArea>

          <TabsContent
            value="colors"
            className="mt-1 size-full overflow-hidden"
          >
            <ScrollArea className="h-full px-4">
              <ControlSection title="Primary Colors" expanded>
                <ColorPicker
                  name="primary"
                  color={currentStyles.primary}
                  onChange={(color) => updateStyle("primary", color)}
                  label="Primary"
                />
                <ColorPicker
                  name="primary-foreground"
                  color={currentStyles["primary-foreground"]}
                  onChange={(color) => updateStyle("primary-foreground", color)}
                  label="Primary Foreground"
                />
              </ControlSection>

              <ControlSection title="Secondary Colors" expanded>
                <ColorPicker
                  name="secondary"
                  color={currentStyles.secondary}
                  onChange={(color) => updateStyle("secondary", color)}
                  label="Secondary"
                />
                <ColorPicker
                  name="secondary-foreground"
                  color={currentStyles["secondary-foreground"]}
                  onChange={(color) =>
                    updateStyle("secondary-foreground", color)
                  }
                  label="Secondary Foreground"
                />
              </ControlSection>

              <ControlSection title="Accent Colors">
                <ColorPicker
                  name="accent"
                  color={currentStyles.accent}
                  onChange={(color) => updateStyle("accent", color)}
                  label="Accent"
                />
                <ColorPicker
                  name="accent-foreground"
                  color={currentStyles["accent-foreground"]}
                  onChange={(color) => updateStyle("accent-foreground", color)}
                  label="Accent Foreground"
                />
              </ControlSection>

              <ControlSection title="Base Colors">
                <ColorPicker
                  name="background"
                  color={currentStyles.background}
                  onChange={(color) => updateStyle("background", color)}
                  label="Background"
                />
                <ColorPicker
                  name="foreground"
                  color={currentStyles.foreground}
                  onChange={(color) => updateStyle("foreground", color)}
                  label="Foreground"
                />
              </ControlSection>

              <ControlSection title="Card Colors">
                <ColorPicker
                  name="card"
                  color={currentStyles.card}
                  onChange={(color) => updateStyle("card", color)}
                  label="Card Background"
                />
                <ColorPicker
                  name="card-foreground"
                  color={currentStyles["card-foreground"]}
                  onChange={(color) => updateStyle("card-foreground", color)}
                  label="Card Foreground"
                />
              </ControlSection>

              <ControlSection title="Popover Colors">
                <ColorPicker
                  name="popover"
                  color={currentStyles.popover}
                  onChange={(color) => updateStyle("popover", color)}
                  label="Popover Background"
                />
                <ColorPicker
                  name="popover-foreground"
                  color={currentStyles["popover-foreground"]}
                  onChange={(color) => updateStyle("popover-foreground", color)}
                  label="Popover Foreground"
                />
              </ControlSection>

              <ControlSection title="Muted Colors">
                <ColorPicker
                  name="muted"
                  color={currentStyles.muted}
                  onChange={(color) => updateStyle("muted", color)}
                  label="Muted"
                />
                <ColorPicker
                  name="muted-foreground"
                  color={currentStyles["muted-foreground"]}
                  onChange={(color) => updateStyle("muted-foreground", color)}
                  label="Muted Foreground"
                />
              </ControlSection>

              <ControlSection title="Destructive Colors">
                <ColorPicker
                  name="destructive"
                  color={currentStyles.destructive}
                  onChange={(color) => updateStyle("destructive", color)}
                  label="Destructive"
                />
                <ColorPicker
                  name="destructive-foreground"
                  color={currentStyles["destructive-foreground"]}
                  onChange={(color) =>
                    updateStyle("destructive-foreground", color)
                  }
                  label="Destructive Foreground"
                />
              </ControlSection>

              <ControlSection title="Border & Input Colors">
                <ColorPicker
                  name="border"
                  color={currentStyles.border}
                  onChange={(color) => updateStyle("border", color)}
                  label="Border"
                />
                <ColorPicker
                  name="input"
                  color={currentStyles.input}
                  onChange={(color) => updateStyle("input", color)}
                  label="Input"
                />
                <ColorPicker
                  name="ring"
                  color={currentStyles.ring}
                  onChange={(color) => updateStyle("ring", color)}
                  label="Ring"
                />
              </ControlSection>

              <ControlSection title="Chart Colors">
                <ColorPicker
                  name="chart-1"
                  color={currentStyles["chart-1"]}
                  onChange={(color) => updateStyle("chart-1", color)}
                  label="Chart 1"
                />
                <ColorPicker
                  name="chart-2"
                  color={currentStyles["chart-2"]}
                  onChange={(color) => updateStyle("chart-2", color)}
                  label="Chart 2"
                />
                <ColorPicker
                  name="chart-3"
                  color={currentStyles["chart-3"]}
                  onChange={(color) => updateStyle("chart-3", color)}
                  label="Chart 3"
                />
                <ColorPicker
                  name="chart-4"
                  color={currentStyles["chart-4"]}
                  onChange={(color) => updateStyle("chart-4", color)}
                  label="Chart 4"
                />
                <ColorPicker
                  name="chart-5"
                  color={currentStyles["chart-5"]}
                  onChange={(color) => updateStyle("chart-5", color)}
                  label="Chart 5"
                />
              </ControlSection>

              <ControlSection title="Sidebar Colors">
                <ColorPicker
                  name="sidebar"
                  color={currentStyles.sidebar}
                  onChange={(color) => updateStyle("sidebar", color)}
                  label="Sidebar Background"
                />
                <ColorPicker
                  name="sidebar-foreground"
                  color={currentStyles["sidebar-foreground"]}
                  onChange={(color) => updateStyle("sidebar-foreground", color)}
                  label="Sidebar Foreground"
                />
                <ColorPicker
                  name="sidebar-primary"
                  color={currentStyles["sidebar-primary"]}
                  onChange={(color) => updateStyle("sidebar-primary", color)}
                  label="Sidebar Primary"
                />
                <ColorPicker
                  name="sidebar-primary-foreground"
                  color={currentStyles["sidebar-primary-foreground"]}
                  onChange={(color) =>
                    updateStyle("sidebar-primary-foreground", color)
                  }
                  label="Sidebar Primary Foreground"
                />
                <ColorPicker
                  name="sidebar-accent"
                  color={currentStyles["sidebar-accent"]}
                  onChange={(color) => updateStyle("sidebar-accent", color)}
                  label="Sidebar Accent"
                />
                <ColorPicker
                  name="sidebar-accent-foreground"
                  color={currentStyles["sidebar-accent-foreground"]}
                  onChange={(color) =>
                    updateStyle("sidebar-accent-foreground", color)
                  }
                  label="Sidebar Accent Foreground"
                />
                <ColorPicker
                  name="sidebar-border"
                  color={currentStyles["sidebar-border"]}
                  onChange={(color) => updateStyle("sidebar-border", color)}
                  label="Sidebar Border"
                />
                <ColorPicker
                  name="sidebar-ring"
                  color={currentStyles["sidebar-ring"]}
                  onChange={(color) => updateStyle("sidebar-ring", color)}
                  label="Sidebar Ring"
                />
              </ControlSection>
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="typography"
            className="mt-1 size-full overflow-hidden"
          >
            <ScrollArea className="h-full px-4">
              <ControlSection title="Letter Spacing" expanded>
                <SliderWithInput
                  value={Number.parseFloat(
                    currentStyles["letter-spacing"]?.replace("em", ""),
                  )}
                  onChange={(value) =>
                    updateStyle("letter-spacing", `${value}em`)
                  }
                  min={-0.5}
                  max={0.5}
                  step={0.025}
                  unit="em"
                  label="Letter Spacing"
                />
              </ControlSection>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="other" className="mt-1 size-full overflow-hidden">
            <ScrollArea className="h-full px-4">
              <ControlSection title="HSL Adjustments" expanded>
                <HslAdjustmentControls />
              </ControlSection>

              <ControlSection title="Radius" expanded>
                <SliderWithInput
                  value={radius}
                  onChange={(value) => updateStyle("radius", `${value}rem`)}
                  min={0}
                  max={5}
                  step={0.025}
                  unit="rem"
                  label="Radius"
                />
              </ControlSection>

              <ControlSection title="Spacing">
                <SliderWithInput
                  value={Number.parseFloat(
                    currentStyles?.spacing?.replace("rem", "") || "0",
                  )}
                  onChange={(value) => updateStyle("spacing", `${value}rem`)}
                  min={0.15}
                  max={0.35}
                  step={0.01}
                  unit="rem"
                  label="Spacing"
                />
              </ControlSection>

              <ControlSection title="Shadow">
                <ShadowControl
                  shadowColor={currentStyles["shadow-color"]}
                  shadowOpacity={Number.parseFloat(
                    currentStyles["shadow-opacity"],
                  )}
                  shadowBlur={Number.parseFloat(
                    currentStyles["shadow-blur"]?.replace("px", ""),
                  )}
                  shadowSpread={Number.parseFloat(
                    currentStyles["shadow-spread"]?.replace("px", ""),
                  )}
                  shadowOffsetX={Number.parseFloat(
                    currentStyles["shadow-offset-x"]?.replace("px", ""),
                  )}
                  shadowOffsetY={Number.parseFloat(
                    currentStyles["shadow-offset-y"]?.replace("px", ""),
                  )}
                  onChange={(key, value) => {
                    if (key === "shadow-color") {
                      updateStyle(key, value as string);
                    } else if (key === "shadow-opacity") {
                      updateStyle(key, value.toString());
                    } else {
                      updateStyle(key as keyof ThemeStyleProps, `${value}px`);
                    }
                  }}
                />
              </ControlSection>
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="openstatus"
            className="mt-1 size-full overflow-hidden"
          >
            <ScrollArea className="h-full px-4">
              <ControlSection title="Openstatus Colors" expanded>
                <ColorPicker
                  name="success"
                  color={currentStyles.success}
                  onChange={(color) => updateStyle("success", color)}
                  label="Success"
                />
                <ColorPicker
                  name="destructive"
                  color={currentStyles.destructive}
                  onChange={(color) => updateStyle("destructive", color)}
                  label="Destructive"
                />
                <ColorPicker
                  name="warning"
                  color={currentStyles.warning}
                  onChange={(color) => updateStyle("warning", color)}
                  label="Warning"
                />
                <ColorPicker
                  name="info"
                  color={currentStyles.info}
                  onChange={(color) => updateStyle("info", color)}
                  label="Info"
                />
              </ControlSection>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default ThemeControlPanel;
