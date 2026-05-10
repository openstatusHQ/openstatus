import { Button } from "@openstatus/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { cn } from "@openstatus/ui/lib/utils";
import {
  type DynamicToolUIPart,
  type ToolUIPart,
  type UITools,
  getToolName,
} from "ai";
import { BracesIcon, ChevronDownIcon, TableIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ChangesTable } from "@/components/common/changes-table";

import { useChatTool } from "./chat-tool-context";
import {
  renderToolDraft,
  renderToolResult,
  summarizeToolOutput,
} from "./tool-renderers";

// SDK tool-part state machine: input-streaming/-available → in-flight;
// approval-requested → HITL gate; approval-responded → about to execute;
// output-available/-error/-denied → terminal.

type ToolState = NonNullable<ToolUIPart["state"]>;

type Props = {
  part: ToolUIPart<UITools> | DynamicToolUIPart;
};

export function ChatToolPart({ part }: Props) {
  const toolName = getToolName(part);
  const { confirmTool, cancelTool } = useChatTool();

  if (part.state === "approval-requested" && part.approval?.id) {
    return (
      <ApprovalCard
        approvalId={part.approval.id}
        toolName={toolName}
        input={part.input}
        confirmTool={confirmTool}
        cancelTool={cancelTool}
      />
    );
  }

  return <ToolDisclosure part={part} toolName={toolName} />;
}

function ApprovalCard({
  approvalId,
  toolName,
  input,
  confirmTool,
  cancelTool,
}: {
  approvalId: string;
  toolName: string;
  input: unknown;
  confirmTool: (id: string) => void;
  cancelTool: (id: string, reason?: string) => void;
}) {
  // Keyboard shortcuts while this HITL card is mounted. The chat surface
  // assumes one approval pending at a time (SDK semantics), so a window
  // listener is fine. Cmd/Ctrl+Enter applies, Esc cancels.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        confirmTool(approvalId);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelTool(approvalId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [approvalId, confirmTool, cancelTool]);

  const draft = renderToolDraft(toolName, input);
  return (
    <div className="not-prose w-full overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center gap-2 p-3 text-sm">
        <ToolStateDot state="approval-requested" />
        <span className="font-commit-mono font-medium">{toolName}</span>
      </div>
      <div className="border-t p-3">
        {draft ? (
          <ChangesTable changes={draft} />
        ) : (
          <pre className="max-h-64 overflow-auto rounded bg-muted/50 p-2 text-xs">
            {JSON.stringify(input, null, 2)}
          </pre>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 border-t bg-muted/30 p-3">
        <span className="text-muted-foreground text-xs">
          <kbd className="rounded border bg-background px-1 font-mono">Esc</kbd>{" "}
          to cancel ·{" "}
          <kbd className="rounded border bg-background px-1 font-mono">⌘ ↵</kbd>{" "}
          to apply
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => cancelTool(approvalId)}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={() => confirmTool(approvalId)}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToolDisclosure({
  part,
  toolName,
}: {
  part: ToolUIPart<UITools> | DynamicToolUIPart;
  toolName: string;
}) {
  const state: ToolState = part.state ?? "output-available";
  const rich = renderToolResult(toolName, part.input, part.output);
  const summary =
    summarizeToolOutput(toolName, part.output) ??
    (state === "output-denied" ? "Cancelled" : undefined);
  // Open by default when a rich renderer has data. During streaming the tool
  // mounts with `output === undefined` (so `rich` is undefined) — auto-open
  // on the first transition to defined, but only once, so a user-driven close
  // afterwards isn't reverted by subsequent output chunks.
  const richDefined = rich !== undefined;
  const [open, setOpen] = useState(richDefined);
  const hasAutoOpened = useRef(richDefined);
  useEffect(() => {
    if (!hasAutoOpened.current && richDefined) {
      hasAutoOpened.current = true;
      setOpen(true);
    }
  }, [richDefined]);
  // When `rich` exists, users can flip to the raw `Parameters`/`Result` JSON
  // panels; without it, the raw view is the only view.
  const [view, setView] = useState<"rich" | "raw">("rich");
  const showRich = rich !== undefined && view === "rich";

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="not-prose group w-full rounded-xl border"
    >
      <div className="flex items-center gap-2 p-3 text-sm">
        <CollapsibleTrigger className="flex flex-1 items-center gap-2 rounded text-left">
          <ToolStateDot state={state} />
          <span className="font-commit-mono font-medium">{toolName}</span>
          {summary ? (
            <span className="text-muted-foreground">· {summary}</span>
          ) : null}
        </CollapsibleTrigger>
        {open && rich !== undefined ? (
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "rich" | "raw")}
          >
            <TabsList className="h-6 p-[2px]">
              <TabsTrigger
                value="rich"
                aria-label="Rich view"
                className="h-[18px] px-1 [&_svg:not([class*='size-'])]:size-3"
              >
                <TableIcon />
              </TabsTrigger>
              <TabsTrigger
                value="raw"
                aria-label="Raw view"
                className="h-[18px] px-1 [&_svg:not([class*='size-'])]:size-3"
              >
                <BracesIcon />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}
        <CollapsibleTrigger
          aria-label={open ? "Collapse" : "Expand"}
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <ChevronDownIcon
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-3 p-3 pt-0">
        {showRich ? (
          rich
        ) : (
          <>
            {part.input !== undefined ? (
              <ToolPanel label="Parameters" body={part.input} />
            ) : null}
            {part.output !== undefined ? (
              <ToolPanel label="Result" body={part.output} />
            ) : null}
          </>
        )}
        {part.state === "output-error" && part.errorText ? (
          <div className="rounded-md bg-destructive/10 p-2 text-destructive text-xs">
            {part.errorText}
          </div>
        ) : null}
        {state === "output-denied" && part.approval?.reason ? (
          <div className="rounded-md bg-muted/50 p-2 text-muted-foreground text-xs">
            {part.approval.reason}
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolPanel({ label, body }: { label: string; body: unknown }) {
  return (
    <div className="space-y-1">
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </h4>
      <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-xs">
        {typeof body === "string" ? body : JSON.stringify(body, null, 2)}
      </pre>
    </div>
  );
}

function ToolStateDot({ state }: { state: ToolState }) {
  const isLoading =
    state === "input-streaming" ||
    state === "input-available" ||
    state === "approval-responded";
  const color =
    state === "output-error"
      ? "bg-destructive"
      : state === "output-denied"
        ? "bg-muted-foreground"
        : state === "output-available"
          ? "bg-success"
          : state === "approval-requested"
            ? "bg-warning"
            : "bg-muted-foreground";
  return (
    <span className="relative inline-flex size-2 shrink-0">
      {isLoading ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-75",
            color,
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
}
