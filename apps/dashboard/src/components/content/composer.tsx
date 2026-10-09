"use client";

import {
  Edit,
  Notification,
  NotificationOff,
  Send,
  Show,
} from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@openstatus/ui/components/ui/input-group";
import { Kbd, KbdGroup } from "@openstatus/ui/components/ui/kbd";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { Toggle } from "@openstatus/ui/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";

import { ProcessMessage } from "@/components/content/process-message";

type ComposerView = "write" | "preview";

const DRAFT_EVENT = "composer-draft";

/**
 * Message text that survives navigation, like Linear's unsent comments.
 * Stored per `key` (e.g. `incident:12`) in localStorage; set "" to clear.
 */
export function useComposerDraft(key: string) {
  const storageKey = `composer-draft:${key}`;
  const value = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(DRAFT_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(DRAFT_EVENT, onChange);
      };
    },
    () => {
      try {
        return localStorage.getItem(storageKey) ?? "";
      } catch {
        return "";
      }
    },
    () => "",
  );
  const setValue = useCallback(
    (next: string) => {
      try {
        if (next) localStorage.setItem(storageKey, next);
        else localStorage.removeItem(storageKey);
      } catch {}
      window.dispatchEvent(new Event(DRAFT_EVENT));
    },
    [storageKey],
  );
  return [value, setValue] as const;
}

// Shared by the header tabs and the footer toggle; Radix keeps its own private.
const ComposerContext = createContext<{
  view: ComposerView;
  setView: (view: ComposerView) => void;
} | null>(null);

function useComposer() {
  const ctx = useContext(ComposerContext);
  if (!ctx)
    throw new Error("Composer parts must be rendered inside <Composer>");
  return ctx;
}

/**
 * Markdown composer: a textarea with a footer for actions, switchable to a
 * rendered preview. Short-form composers toggle the preview from the footer
 * (`ComposerPreviewToggle`); `size="lg"` long-form documents (postmortem)
 * use header tabs (`ComposerHeader`) instead.
 */
export function Composer({
  children,
  className,
  size = "default",
  defaultValue = "write",
  ...props
}: Omit<React.ComponentProps<typeof Tabs>, "value" | "onValueChange"> & {
  size?: "default" | "lg";
  defaultValue?: ComposerView;
}) {
  const [view, setView] = useState<ComposerView>(defaultValue);
  return (
    <ComposerContext.Provider value={{ view, setView }}>
      <Tabs
        value={view}
        onValueChange={(value) => setView(value as ComposerView)}
        data-size={size}
        className={cn("min-w-0 flex-1", className)}
        {...props}
      >
        <InputGroup className="bg-background items-stretch overflow-hidden">
          {children}
        </InputGroup>
      </Tabs>
    </ComposerContext.Provider>
  );
}

/** Write/Preview tabs on the left; `children` replaces the "Markdown" hint on the right. */
export function ComposerHeader({
  children,
  className,
  ...props
}: React.ComponentProps<typeof InputGroupAddon>) {
  return (
    <InputGroupAddon
      align="block-start"
      className={cn(
        "justify-between border-b px-2 py-1.5 [.border-b]:pb-1.5",
        className,
      )}
      {...props}
    >
      <ComposerTabs />
      {children ?? <ComposerHint>Markdown</ComposerHint>}
    </InputGroupAddon>
  );
}

const tabsTriggerClassName =
  "text-muted-foreground hover:text-foreground data-[state=active]:text-foreground dark:data-[state=active]:bg-transparent h-7 flex-none data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent";

function ComposerTabs({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabsList>, "children">) {
  return (
    <TabsList
      className={cn("h-auto rounded-none bg-transparent p-0", className)}
      {...props}
    >
      <TabsTrigger value="write" className={tabsTriggerClassName}>
        Write
      </TabsTrigger>
      <TabsTrigger value="preview" className={tabsTriggerClassName}>
        Preview
      </TabsTrigger>
    </TabsList>
  );
}

export function ComposerHint({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="composer-hint"
      className={cn(
        "text-muted-foreground px-1 text-xs font-normal",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** `onSubmit` fires on Cmd/Ctrl+Enter. */
export function ComposerTextarea({
  className,
  onSubmit,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof InputGroupTextarea> & {
  onSubmit?: () => void;
}) {
  return (
    <TabsContent value="write">
      <InputGroupTextarea
        // leading-6 matches prose-sm so text sits where the preview renders it
        className={cn(
          "min-h-24 leading-6 in-data-[size=lg]:min-h-96",
          className,
        )}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || e.nativeEvent.isComposing) return;
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        {...props}
      />
    </TabsContent>
  );
}

export function ComposerPreview({
  value,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & { value: string }) {
  return (
    <TabsContent value="preview">
      <div
        data-slot="composer-preview"
        className={cn(
          "prose prose-sm dark:prose-invert min-h-24 max-w-none px-3 py-3 in-data-[size=lg]:min-h-96",
          className,
        )}
        {...props}
      >
        {value.trim() ? (
          <ProcessMessage value={value} />
        ) : (
          <p className="text-muted-foreground">Nothing to preview.</p>
        )}
      </div>
    </TabsContent>
  );
}

/** Structured fields between the textarea and the footer. */
export function ComposerSection({
  children,
  className,
  ...props
}: React.ComponentProps<typeof InputGroupAddon>) {
  return (
    <InputGroupAddon
      align="block-end"
      className={cn(
        "flex-col items-stretch gap-1 border-t px-3 py-2 font-normal [.border-t]:pt-2",
        className,
      )}
      {...props}
    >
      {children}
    </InputGroupAddon>
  );
}

export function ComposerFooter({
  children,
  className,
  ...props
}: React.ComponentProps<typeof InputGroupAddon>) {
  return (
    <InputGroupAddon
      align="block-end"
      className={cn(
        "bg-muted/50 flex-wrap justify-between border-t px-2 py-2 font-normal [.border-t]:pt-2",
        className,
      )}
      {...props}
    >
      {children}
    </InputGroupAddon>
  );
}

/** Right-hand footer cluster; takes its own row under the fields on phones. */
export function ComposerActions({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="composer-actions"
      className={cn(
        "ml-auto flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-start",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Icon send button; the tooltip carries the label and the ⌘↵ shortcut. */
export function ComposerSubmit({
  label,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-sm"
          aria-label={label}
          className={cn("ml-auto", className)}
          {...props}
        >
          <Send />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-1.5">
        {label}
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}

// on: bordered like the neighbouring controls; off: flat and muted
const footerToggleClassName =
  "text-muted-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-disabled:opacity-50 aria-pressed:border aria-pressed:shadow-xs";

/**
 * Swaps the textarea for the rendered markdown. The icon is the next action
 * (eye = preview, pencil = write), so it is a plain button, not a pressed toggle.
 */
export function ComposerPreviewToggle() {
  const { view, setView } = useComposer();
  const previewing = view === "preview";
  const label = previewing ? "Back to writing" : "Preview markdown";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={() => setView(previewing ? "write" : "preview")}
          className="text-muted-foreground"
        >
          {previewing ? <Edit /> : <Show />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Bell toggle; without `canNotify` it stays off and the hover explains why. */
export function ComposerNotifyToggle({
  canNotify,
  pressed,
  onPressedChange,
}: {
  canNotify: boolean;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}) {
  const notify = canNotify && pressed;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* aria-disabled (not disabled) so the plan hint still opens */}
        <Toggle
          size="sm"
          aria-label="Notify subscribers"
          pressed={notify}
          aria-disabled={!canNotify}
          onPressedChange={(value) => canNotify && onPressedChange(value)}
          className={footerToggleClassName}
        >
          {notify ? <Notification /> : <NotificationOff />}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent side="top">
        {!canNotify
          ? "Subscriber notifications are not included in your plan."
          : notify
            ? "Subscribers will be notified"
            : "Subscribers will not be notified"}
      </TooltipContent>
    </Tooltip>
  );
}
