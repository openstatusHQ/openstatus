import { Button } from "@openstatus/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { cn } from "@openstatus/ui/lib/utils";
import {
  type DynamicToolUIPart,
  type ToolUIPart,
  type UITools,
  getToolName,
} from "ai";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

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
    const approvalId = part.approval.id;
    const draft = renderToolDraft(toolName, part.input);
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
              {JSON.stringify(part.input, null, 2)}
            </pre>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t bg-muted/30 p-3">
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
    );
  }

  return <ToolDisclosure part={part} toolName={toolName} />;
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
  // Open by default when there's a rich result; raw JSON stays collapsed.
  const [open, setOpen] = useState(rich !== undefined);

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
        {rich ?? (
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
