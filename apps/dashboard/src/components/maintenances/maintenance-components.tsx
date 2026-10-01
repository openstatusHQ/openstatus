"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Close } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";

import { StatusDot } from "@/components/common/status-dot";
import {
  ComponentList,
  ComponentListActions,
  ComponentListAdd,
  ComponentListEmpty,
  ComponentListItem,
  ComponentListName,
} from "@/components/content/component-list";
import { toGroupNameLookup } from "@/data/page-components.client";

import { useUpdateMaintenance } from "./use-update-maintenance";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;

/** Affected components as an inline list: remove per row, add via the picker below. */
export function MaintenanceComponents({
  maintenance,
  components,
  groups,
}: {
  maintenance: Maintenance;
  components: { id: number; name: string; groupId?: number | null }[];
  groups: { id: number; name: string }[];
}) {
  const { update, isPending } = useUpdateMaintenance(maintenance.id);
  const selected = maintenance.pageComponents;
  const addable = components.filter(
    (c) => !maintenance.pageComponentIds.includes(c.id),
  );
  const groupOf = toGroupNameLookup(components, groups);

  return (
    <div className="flex flex-col gap-1">
      {selected.length ? (
        <ComponentList>
          {selected.map((component) => (
            <ComponentListItem key={component.id}>
              <StatusDot variant="info" />
              <ComponentListName group={groupOf.get(component.id)}>
                {component.name}
              </ComponentListName>
              <ComponentListActions>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground invisible size-7 group-hover:visible focus-visible:visible"
                  aria-label={`Remove ${component.name}`}
                  disabled={isPending}
                  onClick={() =>
                    update({
                      pageComponents: maintenance.pageComponentIds.filter(
                        (id) => id !== component.id,
                      ),
                    })
                  }
                >
                  <Close />
                </Button>
              </ComponentListActions>
            </ComponentListItem>
          ))}
        </ComponentList>
      ) : (
        <ComponentListEmpty />
      )}
      <ComponentListAdd
        className="-ml-2"
        components={addable}
        groups={groups}
        disabled={isPending}
        placeholder={
          components.length === 0 ? "No page components yet" : undefined
        }
        onAdd={(id) =>
          update({ pageComponents: [...maintenance.pageComponentIds, id] })
        }
      />
    </div>
  );
}
