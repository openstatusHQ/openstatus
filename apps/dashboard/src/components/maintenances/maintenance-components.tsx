"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useState } from "react";
import { toast } from "sonner";

import {
  DetailSection,
  DetailSectionHeader,
  DetailSectionTitle,
} from "@/components/content/detail";
import { AffectedComponents } from "@/components/status-reports/status-report-components";
import {
  CheckboxTree,
  type CheckboxTreeItem,
} from "@/components/ui/checkbox-tree";
import { toUpdateInput } from "@/data/maintenances.client";
import { useTRPC } from "@/lib/trpc/client";

import { useInvalidateMaintenance } from "./use-invalidate-maintenance";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;

function sameSet(a: number[], b: number[]) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** Affected components with an edit popover around the page's component tree. */
export function MaintenanceComponents({
  maintenance,
  items,
}: {
  maintenance: Maintenance;
  items: CheckboxTreeItem[];
}) {
  const trpc = useTRPC();
  const invalidate = useInvalidateMaintenance(maintenance.id);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<number[]>(maintenance.pageComponentIds);

  const update = useMutation(
    trpc.maintenance.update.mutationOptions({
      onSuccess: () => {
        toast.success("Components saved");
        return invalidate().then(() => setOpen(false));
      },
      onError: (error) => {
        toast.error(
          isTRPCClientError(error) ? error.message : "Failed to save",
        );
      },
    }),
  );

  const dirty = !sameSet(value, maintenance.pageComponentIds);

  return (
    <DetailSection>
      <DetailSectionHeader>
        <DetailSectionTitle>Affected components</DetailSectionTitle>
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setValue(maintenance.pageComponentIds);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-6 px-1.5 text-xs"
            >
              Edit
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-3">
            {items.length ? (
              <CheckboxTree
                items={items}
                value={value}
                onValueChange={setValue}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                No page components yet.
              </p>
            )}
            <div className="mt-3 flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                disabled={update.isPending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7"
                disabled={!dirty || update.isPending}
                onClick={() =>
                  update.mutate({
                    ...toUpdateInput(maintenance),
                    pageComponents: value,
                  })
                }
              >
                Save
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </DetailSectionHeader>
      <AffectedComponents components={maintenance.pageComponents} />
    </DetailSection>
  );
}
