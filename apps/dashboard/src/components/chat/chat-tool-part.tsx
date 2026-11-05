import { Api, ChevronDown, Table } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  type DynamicToolUIPart,
  type ToolUIPart,
  type UITools,
  getToolName,
} from "ai";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { ChangesTable } from "@/components/common/changes-table";
import { useTRPC } from "@/lib/trpc/client";

import { useChatTool } from "./chat-tool-context";
import {
  renderToolDraft,
  renderToolResult,
  summarizeToolOutput,
  toolBeforeIdField,
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
  const idField = toolBeforeIdField(toolName);
  const entityId = idField ? integerField(input, idField) : undefined;
  const loadsBefore = entityId !== undefined;
  const trpc = useTRPC();
  // Fetched fresh for every card (a revert must not reuse the snapshot taken
  // before the change it reverts), then held still so the diff can't shift
  // under the user while the card is open.
  const beforeQuery = useQuery({
    ...trpc.chatSession.approvalBefore.queryOptions({
      toolName,
      ids: idField && entityId !== undefined ? { [idField]: entityId } : {},
    }),
    enabled: loadsBefore,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  // Without a snapshot (no loader, error, entity gone) the card falls back
  // to the proposed values only.
  const loading =
    loadsBefore && (beforeQuery.isPending || !beforeQuery.isFetchedAfterMount);
  const before = loading ? undefined : (beforeQuery.data ?? undefined);

  // Scope key handling to the card so batched approvals / popovers don't share a window listener.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // An open popover (e.g. an entity hover card) already handled this key.
    if (e.defaultPrevented) return;
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!loading) confirmTool(approvalId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelTool(approvalId);
    }
  };

  // While loading, the proposed-only rows give the skeleton its field names.
  const draft = renderToolDraft(toolName, input, before);
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
        {loading ? (
          <Skeleton className="h-4 w-48" />
        ) : before ? (
          <span className="text-muted-foreground flex-1 truncate">
            · {before.label}
          </span>
        ) : null}
      </div>
      <div className="border-t p-3">
        {loading ? (
          <ChangesTableSkeleton
            fields={draft?.map((row) => row.field) ?? [undefined]}
          />
        ) : draft && draft.length === 0 && before ? (
          <p className="text-muted-foreground text-sm">
            No changes: these values are already set.
          </p>
        ) : draft ? (
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
          <Button
            size="sm"
            disabled={loading}
            onClick={() => confirmTool(approvalId)}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Mirrors `ChangesTable`'s grid so the card doesn't jump once values land. */
function ChangesTableSkeleton({ fields }: { fields: (string | undefined)[] }) {
  return (
    <div
      aria-busy
      aria-label="Loading current values"
      className="bg-background overflow-hidden rounded-md border text-sm"
    >
      {fields.map((field, idx) => (
        <div
          key={field ?? idx}
          className={cn(
            "grid grid-cols-1 md:grid-cols-4",
            idx > 0 && "border-t",
          )}
        >
          <div className="bg-muted/40 text-muted-foreground truncate border-r px-3 py-2 font-mono md:col-span-1">
            {field ?? <Skeleton className="my-0.5 h-4 w-16" />}
          </div>
          <div className="grid gap-2 px-3 py-2 md:col-span-3">
            <Skeleton className="my-0.5 h-4 w-32" />
            <Skeleton className="my-0.5 h-4 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The entity id from a tool input. The preview query is a GET, so only this
 * goes in its URL, never free-text fields that may carry secrets (monitor
 * headers, bodies).
 */
function integerField(input: unknown, field: string): number | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : undefined;
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
