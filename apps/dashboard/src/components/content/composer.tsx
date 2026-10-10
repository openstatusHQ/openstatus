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
import { Tabs, TabsContent } from "@openstatus/ui/components/ui/tabs";
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
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { ProcessMessage } from "@/components/content/process-message";
import { useHydrated } from "@/hooks/use-hydrated";
import { useComposedRefs } from "@/lib/composition";

type ComposerView = "write" | "preview";

const DRAFT_EVENT = "composer-draft";
// Drafts localStorage refused (quota, private mode) live here instead, so the
// controlled textarea never snaps back to the stored snapshot.
const memoryDrafts = new Map<string, string>();

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
      const memory = memoryDrafts.get(storageKey);
      if (memory !== undefined) return memory;
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
        memoryDrafts.delete(storageKey);
      } catch {
        memoryDrafts.set(storageKey, next);
      }
      window.dispatchEvent(new Event(DRAFT_EVENT));
    },
    [storageKey],
  );
  return [value, setValue] as const;
}

// Shared by the preview toggle and the Tabs; Radix keeps its own private.
const ComposerContext = createContext<{
  view: ComposerView;
  setView: (view: ComposerView) => void;
  /** Switch views and focus the pane that mounts, so a follow-up E lands. */
  toggleView: () => void;
  /** True once after `toggleView`; the pane mounting next takes it. */
  claimFocus: () => boolean;
} | null>(null);

// Radix mounts tab content a render after the switch, so each pane claims
// focus itself on mount instead of the switcher reaching for it.
function useFocusOnMount() {
  const { claimFocus } = useComposer();
  return useCallback(
    (el: HTMLElement | null) => {
      if (el && claimFocus()) el.focus();
    },
    [claimFocus],
  );
}

// A bare E anywhere on the page flips write/preview, unless a field has
// focus and the letter is typed instead, or an overlay (select, menu,
// dialog) owns the keyboard.
function isPreviewHotkey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false;
  if (e.key.toLowerCase() !== "e" || e.isComposing || e.repeat) return false;
  return !(
    e.target instanceof HTMLElement &&
    (e.target.isContentEditable ||
      e.target.matches("input, textarea, select") ||
      e.target.closest(
        '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="combobox"]',
      ))
  );
}

// With several composers on a page (incident notes and postmortem) the key
// goes to the one last focused or clicked, else the first mounted.
const composers: Array<() => void> = [];
let activeComposer: (() => void) | null = null;

/** "⌘" on Apple platforms, "Ctrl" elsewhere; ⌘ until hydrated. */
function useModifierKey() {
  const hydrated = useHydrated();
  return hydrated && !/Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
    ? "Ctrl"
    : "⌘";
}

function useComposer() {
  const ctx = useContext(ComposerContext);
  if (!ctx)
    throw new Error("Composer parts must be rendered inside <Composer>");
  return ctx;
}

/**
 * Markdown composer: a textarea with a footer for actions, switchable to a
 * rendered preview via `ComposerPreviewToggle`. `size="lg"` is for long-form
 * documents (postmortem) and only raises the minimum height.
 */
export function Composer({
  children,
  className,
  size = "default",
  defaultValue = "write",
  onKeyDown,
  onFocusCapture,
  onPointerDownCapture,
  ...props
}: Omit<React.ComponentProps<typeof Tabs>, "value" | "onValueChange"> & {
  size?: "default" | "lg";
  defaultValue?: ComposerView;
}) {
  const [view, setView] = useState<ComposerView>(defaultValue);
  const focusNext = useRef(false);
  const toggleView = useCallback(() => {
    focusNext.current = true;
    setView((v) => (v === "write" ? "preview" : "write"));
  }, []);
  const claimFocus = useCallback(() => {
    if (!focusNext.current) return false;
    focusNext.current = false;
    return true;
  }, []);
  useEffect(() => {
    composers.push(toggleView);
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPreviewHotkey(e)) return;
      if ((activeComposer ?? composers[0]) !== toggleView) return;
      e.preventDefault();
      toggleView();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      composers.splice(composers.indexOf(toggleView), 1);
      if (activeComposer === toggleView) activeComposer = null;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [toggleView]);
  return (
    <ComposerContext.Provider value={{ view, setView, toggleView, claimFocus }}>
      <Tabs
        value={view}
        onValueChange={(value) => setView(value as ComposerView)}
        data-size={size}
        className={cn("min-w-0 flex-1", className)}
        // Escape leaves the composer so the page's own keys (E, F, …) apply;
        // an open menu or tooltip has already consumed it by then
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || e.nativeEvent.isComposing) return;
          if (e.key !== "Escape") return;
          e.preventDefault();
          if (document.activeElement instanceof HTMLElement)
            document.activeElement.blur();
        }}
        onFocusCapture={(e) => {
          onFocusCapture?.(e);
          activeComposer = toggleView;
        }}
        onPointerDownCapture={(e) => {
          onPointerDownCapture?.(e);
          activeComposer = toggleView;
        }}
        {...props}
      >
        <InputGroup className="bg-background items-stretch overflow-hidden">
          {children}
        </InputGroup>
      </Tabs>
    </ComposerContext.Provider>
  );
}

/** `onSubmit` fires on Cmd/Ctrl+Enter. */
export function ComposerTextarea({
  className,
  onSubmit,
  onKeyDown,
  ref,
  ...props
}: React.ComponentProps<typeof InputGroupTextarea> & {
  onSubmit?: () => void;
}) {
  const focusOnMount = useComposedRefs(ref, useFocusOnMount());
  return (
    <TabsContent value="write">
      <InputGroupTextarea
        ref={focusOnMount}
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
  ref,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & { value: string }) {
  const focusOnMount = useComposedRefs(ref, useFocusOnMount());
  return (
    <TabsContent value="preview">
      <div
        ref={focusOnMount}
        data-slot="composer-preview"
        // focusable so the hotkey can flip back without a pointer
        tabIndex={-1}
        className={cn(
          "prose prose-sm dark:prose-invert min-h-24 max-w-none px-3 py-3 outline-none in-data-[size=lg]:min-h-96",
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

/** Icon send button; the tooltip carries the label and the ⌘/Ctrl+↵ shortcut. */
export function ComposerSubmit({
  label,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & { label: string }) {
  const modifier = useModifierKey();
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
          <Kbd>{modifier}</Kbd>
          <Kbd>↵</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}

// on: bordered like the neighbouring controls; off: flat and muted
const footerToggleClassName =
  "text-muted-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-disabled:opacity-50 aria-pressed:border aria-pressed:shadow-xs";

/** Ghost icon button for the footer; the tooltip carries the label and keys. */
export function ComposerIconButton({
  label,
  shortcut,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  label: string;
  shortcut?: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className={cn("text-muted-foreground", className)}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-1.5">
        {label}
        {shortcut}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Swaps the textarea for the rendered markdown. The icon is the next action
 * (eye = preview, pencil = write), so it is a plain button, not a pressed toggle.
 */
export function ComposerPreviewToggle() {
  const { view, toggleView } = useComposer();
  const previewing = view === "preview";
  return (
    <ComposerIconButton
      label={previewing ? "Back to writing" : "Preview markdown"}
      shortcut={<Kbd>E</Kbd>}
      onClick={toggleView}
    >
      {previewing ? <Edit /> : <Show />}
    </ComposerIconButton>
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
