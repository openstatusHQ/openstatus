import { Api, ChevronDown, Table } from "@openstatus/icons";
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
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

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
  // Scope key handling to the card so batched approvals / popovers don't share a window listener.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      confirmTool(approvalId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelTool(approvalId);
    }
  };

  const draft = renderToolDraft(toolName, input);
  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="not-prose bg-background w-full overflow-hidden rounded-xl border outline-none"
    >
      <div className="flex items-center gap-2 p-3 text-sm">
        <ToolStateDot state="approval-requested" />
        <span className="font-commit-mono font-medium">{toolName}</span>
      </div>
      <div className="border-t p-3">
        {draft ? (
          <ChangesTable changes={draft} />
        ) : (
          <pre className="bg-muted/50 max-h-64 overflow-auto rounded p-2 text-xs">
            {JSON.stringify(input, null, 2)}
          </pre>
        )}
      </div>
      <div className="bg-muted/30 flex items-center justify-end gap-3 border-t p-3">
        <span className="text-muted-foreground text-xs">
          <kbd className="bg-background rounded border px-1 font-mono">Esc</kbd>{" "}
          to cancel ·{" "}
          <kbd className="bg-background rounded border px-1 font-mono">⌘ ↵</kbd>{" "}
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
  const [open, setOpen] = useState(false);
  // Gate the height animation behind a post-mount flag so a tool that mounts
  // already-open doesn't play the open animation on first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [view, setView] = useState<"rich" | "raw">("rich");
  const showRich = rich !== undefined && view === "rich";

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="not-prose group w-full rounded-xl border"
    >
      <CollapsibleTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-xl p-3 text-left text-sm"
        >
          <ToolStateDot state={state} />
          <span className="font-commit-mono font-medium">{toolName}</span>
          <span className="text-muted-foreground flex-1 truncate">
            {summary ? `· ${summary}` : null}
          </span>
          {rich !== undefined ? (
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className={cn(!open && "invisible")}
              aria-hidden={!open}
            >
              <Tabs
                value={view}
                onValueChange={(v) => setView(v as "rich" | "raw")}
              >
                <TabsList className="h-6 p-[2px]">
                  <TabsTrigger
                    value="rich"
                    aria-label="Rich view"
                    tabIndex={open ? 0 : -1}
                    className="h-[18px] px-1 [&_svg:not([class*='size-'])]:size-3"
                  >
                    <Table />
                  </TabsTrigger>
                  <TabsTrigger
                    value="raw"
                    aria-label="Raw view"
                    tabIndex={open ? 0 : -1}
                    className="h-[18px] px-1 [&_svg:not([class*='size-'])]:size-3"
                  >
                    <Api />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          ) : null}
          <ChevronDown
            className={cn(
              "text-muted-foreground size-4 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent
        data-animate={mounted}
        className={cn(
          "overflow-hidden",
          "data-[animate=true]:data-[state=closed]:animate-collapsible-up data-[animate=true]:data-[state=open]:animate-collapsible-down",
        )}
      >
        <div className="space-y-3 p-3 pt-0">
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
            <div className="bg-destructive/10 text-destructive rounded-md p-2 text-xs">
              {part.errorText}
            </div>
          ) : null}
          {state === "output-denied" && part.approval?.reason ? (
            <div className="bg-muted/50 text-muted-foreground rounded-md p-2 text-xs">
              {part.approval.reason}
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolPanel({ label, body }: { label: string; body: unknown }) {
  return (
    <div className="space-y-1">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </h4>
      <pre className="bg-muted/50 overflow-x-auto rounded-md p-2 text-xs">
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
