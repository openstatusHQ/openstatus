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
 * Shapes we care about (from AI SDK v6 `UIToolInvocation`):
 *
 *   { type: "tool-<name>", toolCallId, state, input?, output?, errorText?,
 *     approval?: { id, approved?, reason? } }
 *
 * State machine:
 *   - `input-streaming` / `input-available` → in-flight tool call (read
 *     tools auto-execute; destructive tools never sit here because
 *     they're approval-gated below).
 *   - `approval-requested` → destructive tool paused for HITL. Render a
 *     Confirm/Cancel card; resolve via `addToolApprovalResponse` upstream.
 *   - `approval-responded` → user approved, server about to run execute.
 *     Treated as a brief loading state.
 *   - `output-available` → done, render the result.
 *   - `output-error` → server execute threw. Show error.
 *   - `output-denied` → user cancelled. Show a muted "denied" card.
 */

type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

type ToolPart = {
  type: string;
  state?: ToolState;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approval?: { id: string; approved?: boolean; reason?: string };
};

type Props = {
  part: ToolPart;
  onConfirm: (args: {
    approvalId: string;
    toolName: string;
    input: unknown;
  }) => void;
  onCancel: (args: { approvalId: string; toolName: string }) => void;
};

export function ChatToolPart({ part, onConfirm, onCancel }: Props) {
  const toolName = part.type.startsWith("tool-")
    ? part.type.slice("tool-".length)
    : part.type;

  // Approval-requested: render Confirm/Cancel. The approval id (NOT
  // the toolCallId) is what `addToolApprovalResponse` consumes —
  // pass it up via the handlers.
  if (part.state === "approval-requested" && part.approval?.id) {
    const approvalId = part.approval.id;
    const renderDraft =
      toolRenderers[toolName as keyof typeof toolRenderers]?.renderDraft;
    return (
      <div className="not-prose w-full overflow-hidden rounded-xl border bg-background">
        <div className="flex items-center gap-2 p-3 text-sm">
          <ToolStateDot state="approval-requested" />
          <span className="font-commit-mono font-medium">{toolName}</span>
        </div>
        <div className="border-t p-3">
          {renderDraft ? (
            <ChangesTable changes={renderDraft(part.input as never)} />
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
            onClick={() => onCancel({ approvalId, toolName })}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() =>
              onConfirm({ approvalId, toolName, input: part.input })
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
  const renderer = toolRenderers[toolName as keyof typeof toolRenderers];
  const renderResult = renderer?.renderResult;
  const hasRichResult = renderResult !== undefined && part.output !== undefined;
  const summary =
    part.output !== undefined && renderer?.summary
      ? renderer.summary(part.output as never)
      : state === "output-denied"
        ? "Cancelled"
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
          renderResult({
            input: part.input as never,
            output: part.output as never,
          })
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
