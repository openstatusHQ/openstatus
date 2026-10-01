"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

import {
  Composer,
  ComposerFooter,
  ComposerHeader,
  ComposerPreview,
  ComposerTextarea,
} from "@/components/content/composer";

import { useUpdateMaintenance } from "./use-update-maintenance";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;

/** The single maintenance message: edit in place, save explicitly, no matter the status. */
export function MaintenanceComposer({
  maintenance,
}: {
  maintenance: Maintenance;
}) {
  // null = pristine: the editor follows the server copy, so a background
  // refetch never clobbers unsaved edits.
  const [draft, setDraft] = useState<string | null>(null);
  const server = maintenance.message;
  const content = draft ?? server;
  const { update, isPending } = useUpdateMaintenance(maintenance.id, {
    onSuccess: () => {
      toast.success("Message saved");
      setDraft(null);
    },
  });

  const dirty = draft !== null && draft !== server;
  const canSave = dirty && !isPending;
  const submit = () => update({ message: content });

  return (
    <Composer size="lg">
      <ComposerHeader />
      <ComposerTextarea
        aria-label="Message"
        placeholder="What is being maintained and what customers can expect."
        value={content}
        onChange={(e) => setDraft(e.target.value)}
        onSubmit={canSave ? submit : undefined}
      />
      <ComposerPreview value={content} />
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
              disabled={isPending}
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
