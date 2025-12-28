import { CopyButton } from "@/components/copy-button";
import { TooltipWrapper } from "@/components/tooltip-wrapper";
import { Button } from "@/components/ui/button";
import { SquarePen } from "lucide-react";
import {
  type FocusColorId,
  useColorControlFocus,
} from "../store/color-control-focus-store";
import type { ThemeEditorPreviewProps } from "../types/theme";

interface ColorPreviewProps {
  styles: ThemeEditorPreviewProps["styles"];
  currentMode: ThemeEditorPreviewProps["currentMode"];
}

function ColorPreviewItem({
  label,
  color,
  name,
}: { label: string; color: string; name: string }) {
  const { focusColor } = useColorControlFocus();

  return (
    <div className="group/color-preview relative flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-muted/60">
      <div
        className="@max-3xl:size-12 size-14 shrink-0 rounded-md border"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 space-y-1 overflow-hidden">
        <p className="line-clamp-2 font-medium @max-3xl:text-xs text-sm leading-tight">
          {label}
        </p>
        <p className="truncate font-mono text-muted-foreground text-xs">
          {color}
        </p>
      </div>

      <div className="hidden flex-col opacity-0 transition-opacity group-hover/color-preview:opacity-100 md:flex">
        <TooltipWrapper label="Edit color" asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => focusColor(name as FocusColorId)}
            className="@max-3xl:size-6 size-7 [&>svg]:size-3.5"
          >
            <SquarePen />
          </Button>
        </TooltipWrapper>
        <CopyButton textToCopy={color} className="@max-3xl:size-6 size-7" />
      </div>
    </div>
  );
}

const ColorPreview = ({ styles, currentMode }: ColorPreviewProps) => {
  if (!styles || !styles[currentMode]) {
    return null;
  }

  return (
    <div className="@container grid grid-cols-1 gap-4 md:gap-8">
      {/* Primary Colors */}
      <div className="@max-3xl:space-y-2 space-y-4">
        <h3 className="font-semibold text-muted-foreground text-sm">
          Primary Theme Colors
        </h3>
        <div className="@6xl grid @2xl:grid-cols-3 @4xl:grid-cols-4 @sm:grid-cols-2 grid-cols-1 gap-2">
          <ColorPreviewItem
            label="Background"
            color={styles[currentMode].background}
            name="background"
          />
          <ColorPreviewItem
            label="Foreground"
            color={styles[currentMode].foreground}
            name="foreground"
          />
          <ColorPreviewItem
            label="Primary"
            color={styles[currentMode].primary}
            name="primary"
          />
          <ColorPreviewItem
            label="Primary Foreground"
            color={styles[currentMode]["primary-foreground"]}
            name="primary-foreground"
          />
        </div>
      </div>

      {/* Secondary & Accent Colors */}
      <div className="@max-3xl:space-y-2 space-y-4">
        <h3 className="font-semibold text-muted-foreground text-sm">
          Secondary & Accent Colors
        </h3>
        <div className="@6xl grid @2xl:grid-cols-3 @4xl:grid-cols-4 @sm:grid-cols-2 grid-cols-1 gap-4">
          <ColorPreviewItem
            label="Secondary"
            color={styles[currentMode].secondary}
            name="secondary"
          />
          <ColorPreviewItem
            label="Secondary Foreground"
            color={styles[currentMode]["secondary-foreground"]}
            name="secondary-foreground"
          />
          <ColorPreviewItem
            label="Accent"
            color={styles[currentMode].accent}
            name="accent"
          />
          <ColorPreviewItem
            label="Accent Foreground"
            color={styles[currentMode]["accent-foreground"]}
            name="accent-foreground"
          />
        </div>
      </div>

      {/* UI Component Colors */}
      <div className="@max-3xl:space-y-2 space-y-4">
        <h3 className="font-semibold text-muted-foreground text-sm">
          UI Component Colors
        </h3>
        <div className="grid @2xl:grid-cols-3 @4xl:grid-cols-4 @sm:grid-cols-2 grid-cols-1 gap-4">
          <ColorPreviewItem
            label="Card"
            color={styles[currentMode].card}
            name="card"
          />
          <ColorPreviewItem
            label="Card Foreground"
            color={styles[currentMode]["card-foreground"]}
            name="card-foreground"
          />
          <ColorPreviewItem
            label="Popover"
            color={styles[currentMode].popover}
            name="popover"
          />
          <ColorPreviewItem
            label="Popover Foreground"
            color={styles[currentMode]["popover-foreground"]}
            name="popover-foreground"
          />
          <ColorPreviewItem
            label="Muted"
            color={styles[currentMode].muted}
            name="muted"
          />
          <ColorPreviewItem
            label="Muted Foreground"
            color={styles[currentMode]["muted-foreground"]}
            name="muted-foreground"
          />
        </div>
      </div>

      {/* Utility & Form Colors */}
      <div className="@max-3xl:space-y-2 space-y-4">
        <h3 className="font-semibold text-muted-foreground text-sm">
          Utility & Form Colors
        </h3>
        <div className="grid @2xl:grid-cols-3 @4xl:grid-cols-4 @sm:grid-cols-2 grid-cols-1 gap-4">
          <ColorPreviewItem
            label="Border"
            color={styles[currentMode].border}
            name="border"
          />
          <ColorPreviewItem
            label="Input"
            color={styles[currentMode].input}
            name="input"
          />
          <ColorPreviewItem
            label="Ring"
            color={styles[currentMode].ring}
            name="ring"
          />
        </div>
      </div>

      {/* Status & Feedback Colors */}
      <div className="@max-3xl:space-y-2 space-y-4">
        <h3 className="font-semibold text-muted-foreground text-sm">
          Status & Feedback Colors
        </h3>
        <div className="grid @2xl:grid-cols-3 @4xl:grid-cols-4 @sm:grid-cols-2 grid-cols-1 gap-4">
          <ColorPreviewItem
            label="Destructive"
            color={styles[currentMode].destructive}
            name="destructive"
          />
          <ColorPreviewItem
            label="Destructive Foreground"
            color={styles[currentMode]["destructive-foreground"]}
            name="destructive-foreground"
          />
        </div>
      </div>

      {/* Chart & Data Visualization Colors */}
      <div className="@max-3xl:space-y-2 space-y-4">
        <h3 className="font-semibold text-muted-foreground text-sm">
          Chart & Visualization Colors
        </h3>
        <div className="grid @2xl:grid-cols-3 @4xl:grid-cols-4 @sm:grid-cols-2 grid-cols-1 gap-4">
          <ColorPreviewItem
            label="Chart 1"
            color={styles[currentMode]["chart-1"]}
            name="chart-1"
          />
          <ColorPreviewItem
            label="Chart 2"
            color={styles[currentMode]["chart-2"]}
            name="chart-2"
          />
          <ColorPreviewItem
            label="Chart 3"
            color={styles[currentMode]["chart-3"]}
            name="chart-3"
          />
          <ColorPreviewItem
            label="Chart 4"
            color={styles[currentMode]["chart-4"]}
            name="chart-4"
          />
          <ColorPreviewItem
            label="Chart 5"
            color={styles[currentMode]["chart-5"]}
            name="chart-5"
          />
        </div>
      </div>

      {/* Sidebar Colors */}
      <div className="@max-3xl:space-y-2 space-y-4">
        <h3 className="font-semibold text-muted-foreground text-sm">
          Sidebar & Navigation Colors
        </h3>
        <div className="grid @2xl:grid-cols-3 @4xl:grid-cols-4 @sm:grid-cols-2 grid-cols-1 gap-4">
          <ColorPreviewItem
            label="Sidebar Background"
            color={styles[currentMode].sidebar}
            name="sidebar"
          />
          <ColorPreviewItem
            label="Sidebar Foreground"
            color={styles[currentMode]["sidebar-foreground"]}
            name="sidebar-foreground"
          />
          <ColorPreviewItem
            label="Sidebar Primary"
            color={styles[currentMode]["sidebar-primary"]}
            name="sidebar-primary"
          />
          <ColorPreviewItem
            label="Sidebar Primary Foreground"
            color={styles[currentMode]["sidebar-primary-foreground"]}
            name="sidebar-primary-foreground"
          />
          <ColorPreviewItem
            label="Sidebar Accent"
            color={styles[currentMode]["sidebar-accent"]}
            name="sidebar-accent"
          />
          <ColorPreviewItem
            label="Sidebar Accent Foreground"
            color={styles[currentMode]["sidebar-accent-foreground"]}
            name="sidebar-accent-foreground"
          />
          <ColorPreviewItem
            label="Sidebar Border"
            color={styles[currentMode]["sidebar-border"]}
            name="sidebar-border"
          />
          <ColorPreviewItem
            label="Sidebar Ring"
            color={styles[currentMode]["sidebar-ring"]}
            name="sidebar-ring"
          />
        </div>
      </div>
    </div>
  );
};

export default ColorPreview;
