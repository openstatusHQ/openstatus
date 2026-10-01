"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useState } from "react";
import { toast } from "sonner";

import {
  Composer,
  ComposerFooter,
  ComposerHeader,
  ComposerHint,
  ComposerPreview,
  ComposerTabs,
  ComposerTextarea,
} from "@/components/content/composer";
import { toUpdateInput } from "@/data/maintenances.client";
import { useTRPC } from "@/lib/trpc/client";

import { useInvalidateMaintenance } from "./use-invalidate-maintenance";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;

/** The single maintenance message: edit in place, save explicitly, no matter the status. */
export function MaintenanceComposer({
  maintenance,
}: {
  maintenance: Maintenance;
}) {
  const trpc = useTRPC();
  const invalidate = useInvalidateMaintenance(maintenance.id);
  // null = pristine: the editor follows the server copy, so a background
  // refetch never clobbers unsaved edits.
  const [draft, setDraft] = useState<string | null>(null);
  const server = maintenance.message;
  const content = draft ?? server;

  const save = useMutation(
    trpc.maintenance.update.mutationOptions({
      onSuccess: () => {
        toast.success("Message saved");
        return invalidate().then(() => setDraft(null));
      },
      onError: (error) => {
        toast.error(
          isTRPCClientError(error) ? error.message : "Failed to save",
        );
      },
    }),
  );

  const dirty = draft !== null && draft !== server;
  const canSave = dirty && !save.isPending;
  const submit = () =>
    save.mutate({ ...toUpdateInput(maintenance), message: content });

  return (
    <Composer>
      <ComposerHeader>
        <ComposerTabs />
        <ComposerHint>Markdown</ComposerHint>
      </ComposerHeader>
      <ComposerTextarea
        aria-label="Message"
        className="min-h-96"
        placeholder="What is being maintained and what customers can expect."
        value={content}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSave) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <ComposerPreview value={content} className="min-h-96" />
      <ComposerFooter>
        <span className="text-xs">
          {dirty
            ? "Unsaved changes"
            : "Visible to everyone on your status page"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {dirty ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={save.isPending}
              onClick={() => setDraft(null)}
            >
              Reset
            </Button>
          ) : null}
          <Button size="sm" disabled={!canSave} onClick={submit}>
            Save
          </Button>
        </div>
      </ComposerFooter>
    </Composer>
  );
}
