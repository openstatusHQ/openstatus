"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Close } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { toast } from "sonner";

import { StatusDot } from "@/components/common/status-dot";
import {
  ComponentList,
  ComponentListEmpty,
  ComponentListItem,
  ComponentListName,
  ComponentListSelectTrigger,
} from "@/components/content/component-list";
import { toUpdateInput } from "@/data/maintenances.client";
import { useTRPC } from "@/lib/trpc/client";

import { useInvalidateMaintenance } from "./use-invalidate-maintenance";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;
type Component = { id: number; name: string; groupId?: number | null };
type Group = { id: number; name: string };

/** Affected components as an inline list: remove per row, add via the picker below. */
export function MaintenanceComponents({
  maintenance,
  components,
  groups = [],
}: {
  maintenance: Maintenance;
  components: Component[];
  groups?: Group[];
}) {
  const trpc = useTRPC();
  const invalidate = useInvalidateMaintenance(maintenance.id);

  const update = useMutation(
    trpc.maintenance.update.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => {
        toast.error(
          isTRPCClientError(error) ? error.message : "Failed to save",
        );
      },
    }),
  );

  function save(pageComponents: number[]) {
    update.mutate({ ...toUpdateInput(maintenance), pageComponents });
  }

  const selected = maintenance.pageComponents;
  const addable = components.filter(
    (c) => !maintenance.pageComponentIds.includes(c.id),
  );
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const byGroup = new Map<number | null, Component[]>();
  for (const c of addable) {
    const key =
      c.groupId != null && groupName.has(c.groupId) ? c.groupId : null;
    byGroup.set(key, [...(byGroup.get(key) ?? []), c]);
  }

  return (
    <div className="flex flex-col gap-1">
      {selected.length ? (
        <ComponentList>
          {selected.map((component) => (
            <ComponentListItem key={component.id}>
              <StatusDot variant="info" />
              <ComponentListName>{component.name}</ComponentListName>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground invisible ml-auto size-7 group-hover:visible focus-visible:visible"
                aria-label={`Remove ${component.name}`}
                disabled={update.isPending}
                onClick={() =>
                  save(
                    maintenance.pageComponentIds.filter(
                      (id) => id !== component.id,
                    ),
                  )
                }
              >
                <Close />
              </Button>
            </ComponentListItem>
          ))}
        </ComponentList>
      ) : (
        <ComponentListEmpty />
      )}
      <Select
        value=""
        disabled={addable.length === 0 || update.isPending}
        onValueChange={(value) =>
          save([...maintenance.pageComponentIds, Number(value)])
        }
      >
        <ComponentListSelectTrigger
          aria-label="Add component"
          className="text-muted-foreground -ml-2"
        >
          <SelectValue
            placeholder={
              components.length === 0
                ? "No page components yet"
                : addable.length
                  ? "Add component"
                  : "All components added"
            }
          />
        </ComponentListSelectTrigger>
        <SelectContent>
          {[...byGroup.entries()].map(([groupId, items]) => {
            const options = items.map((c) => (
              <SelectItem key={c.id} value={String(c.id)} className="font-mono">
                {c.name}
              </SelectItem>
            ));
            if (groupId === null) return options;
            return (
              <SelectGroup key={groupId}>
                <SelectLabel>{groupName.get(groupId)}</SelectLabel>
                {options}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
