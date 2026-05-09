import { Button } from "@openstatus/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { cn } from "@openstatus/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { ChangesTable } from "@/components/common/changes-table";
import { toolRenderers } from "./tool-renderers";

/**
 * Render a tool-related UIMessage part.
 *
 * Shapes we care about (from AI SDK):
 *   { type: "tool-<name>", state: "input-streaming" | "input-available"
 *     | "output-available" | "output-error", toolCallId, input, output? }
 *
 * Branches:
 *   - destructive + still pending input  → custom Confirm/Cancel card.
 *     The AI SDK omits `execute` server-side, so the part stays in
 *     `input-available` until the client posts to `/api/chat/confirm`
 *     and resumes via `addToolOutput`.
 *   - everything else (read tools, post-confirm output)  → minimal
 *     collapsible with raw JSON (no `shiki` syntax highlighting — the
 *     dev cost of one extra dep wasn't worth the polish).
 */

type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

type ToolPart = {
  type: string;
  state?: ToolState;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type Props = {
  part: ToolPart;
  onConfirm: (args: {
    toolCallId: string;
    toolName: string;
    input: unknown;
  }) => void;
  onCancel: (args: { toolCallId: string; toolName: string }) => void;
};

// Whitelist sourced from the registry's `destructive: true` tools — keeps
// the HITL UI in sync with what the server actually pauses on. If a new
// destructive tool ships, add it here in the same PR that adds it to the
// registry.
const DESTRUCTIVE_TOOL_NAMES = new Set([
  "create_status_report",
  "add_status_report_update",
  "update_status_report",
  "resolve_status_report",
  "create_maintenance",
]);

export function ChatToolPart({ part, onConfirm, onCancel }: Props) {
  const toolName = part.type.startsWith("tool-")
    ? part.type.slice("tool-".length)
    : part.type;
  const toolCallId = part.toolCallId ?? "";
  const isDestructive = DESTRUCTIVE_TOOL_NAMES.has(toolName);
  const isPendingConfirm =
    part.state === "input-available" &&
    part.output === undefined &&
    isDestructive;

  if (isPendingConfirm) {
    const renderDraft = toolRenderers[toolName]?.renderDraft;
    return (
      <div className="not-prose w-full overflow-hidden rounded-xl border bg-background">
        <div className="flex items-center gap-2 p-3 text-sm">
          <ToolStateDot state={part.state ?? "input-available"} />
          <span className="font-commit-mono font-medium">{toolName}</span>
        </div>
        <div className="border-t p-3">
          {renderDraft ? (
            <ChangesTable changes={renderDraft(part.input)} />
          ) : (
            <pre className="max-h-64 overflow-auto rounded bg-muted/50 p-2 text-xs">
              {JSON.stringify(part.input, null, 2)}
            </pre>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t bg-muted/30 p-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCancel({ toolCallId, toolName })}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() =>
              onConfirm({ toolCallId, toolName, input: part.input })
            }
          >
            Apply
          </Button>
        </div>
      </div>
    );
  }

  return <ToolDisclosure part={part} toolName={toolName} />;
}

function ToolDisclosure({
  part,
  toolName,
}: {
  part: ToolPart;
  toolName: string;
}) {
  const state = part.state ?? "output-available";
  const renderer = toolRenderers[toolName];
  const renderResult = renderer?.renderResult;
  const hasRichResult = renderResult !== undefined && part.output !== undefined;
  const summary =
    part.output !== undefined && renderer?.summary
      ? renderer.summary(part.output)
      : undefined;
  // Open by default when there's a rich result so the user sees it
  // without an extra click; raw JSON view stays collapsed.
  const [open, setOpen] = useState(hasRichResult);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="not-prose group w-full rounded-xl border"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-3 text-sm">
        <span className="flex flex-1 items-center gap-2">
          <ToolStateDot state={state} />
          <span className="font-commit-mono font-medium">{toolName}</span>
          {summary ? (
            <span className="text-muted-foreground">· {summary}</span>
          ) : null}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 p-3 pt-0">
        {hasRichResult ? (
          renderResult({ input: part.input, output: part.output })
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
        {part.errorText ? (
          <div className="rounded-md bg-destructive/10 p-2 text-destructive text-xs">
            {part.errorText}
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
  const isLoading = state === "input-streaming" || state === "input-available";
  const color =
    state === "output-error"
      ? "bg-destructive"
      : state === "output-available"
        ? "bg-success"
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
