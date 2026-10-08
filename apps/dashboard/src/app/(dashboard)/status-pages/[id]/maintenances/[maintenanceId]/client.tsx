"use client";

import { Add } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceStrict } from "date-fns";
import { toast } from "sonner";

import {
  DetailActions,
  DetailAside,
  DetailContent,
  DetailHeader,
  DetailInput,
  DetailMain,
  DetailMeta,
  DetailMetaItem,
  DetailMetaTime,
  DetailSection,
  DetailSectionTitle,
  DetailTitle,
  DetailTitleRow,
} from "@/components/content/detail";
import { SectionGroup } from "@/components/content/section";
import { FormCardGroup } from "@/components/forms/form-card";
import { FormSheetWithDirtyProtection } from "@/components/forms/form-sheet";
import { FormMaintenanceUpdateCard } from "@/components/forms/maintenance-update/card";
import { FormSheetMaintenanceUpdate } from "@/components/forms/maintenance-update/sheet";
import { MaintenanceActions } from "@/components/maintenances/maintenance-actions";
import { MaintenanceComponents } from "@/components/maintenances/maintenance-components";
import { MaintenanceComposer } from "@/components/maintenances/maintenance-composer";
import { MaintenanceProperties } from "@/components/maintenances/maintenance-properties";
import { useInvalidateMaintenance } from "@/components/maintenances/use-invalidate-maintenance";
import { useMaintenanceStatus } from "@/components/maintenances/use-maintenance-status";
import { useUpdateMaintenance } from "@/components/maintenances/use-update-maintenance";
import { Notifications } from "@/components/status-pages/notifications";
import { getPageUrl } from "@/data/status-pages.client";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

export function Client({ id, pageId }: { id: number; pageId: number }) {
  const trpc = useTRPC();
  const { data: maintenance } = useQuery(
    trpc.maintenance.get.queryOptions({ id }),
  );
  const { data: page } = useQuery(trpc.page.get.queryOptions({ id: pageId }));
  const rename = useUpdateMaintenance(id);
  const invalidate = useInvalidateMaintenance(id);
  const onError = (error: unknown) => {
    toast.error(errorMessage(error, "Failed to save"));
  };
  const notify = useMutation(
    trpc.subscriberNotification.maintenanceUpdate.mutationOptions({
      onError: (error) => {
        toast.error(errorMessage(error, "Failed to notify subscribers"));
      },
    }),
  );
  const createUpdate = useMutation(
    trpc.maintenance.createUpdate.mutationOptions({
      onSuccess: async (update) => {
        if (update?.notifySubscribers) notify.mutate({ id: update.id });
        await invalidate();
      },
      onError,
    }),
  );
  const editUpdate = useMutation(
    trpc.maintenance.updateUpdate.mutationOptions({
      onSuccess: invalidate,
      onError,
    }),
  );
  const deleteUpdate = useMutation(
    trpc.maintenance.deleteUpdate.mutationOptions({
      onSuccess: invalidate,
      onError,
    }),
  );
  const status = useMaintenanceStatus(
    maintenance ?? { from: new Date(0), to: new Date(0) },
  );

  if (!maintenance || !page) return null;

  const publicUrl = `${getPageUrl(page)}/events/maintenance/${maintenance.id}`;
  const updates = [...maintenance.updates].sort(
    (a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id,
  );

  return (
    <SectionGroup>
      <DetailHeader>
        <DetailTitleRow>
          <DetailTitle>
            <DetailInput
              aria-label="Title"
              required
              maxLength={256}
              disabled={rename.isPending}
              value={maintenance.title}
              onCommit={(title) => rename.update({ title })}
            />
          </DetailTitle>
          <DetailActions>
            <MaintenanceActions
              maintenance={maintenance}
              publicUrl={publicUrl}
            />
          </DetailActions>
        </DetailTitleRow>
        <DetailMeta>
          <DetailMetaItem>
            {status === "scheduled" ? "Starts" : "Started"}{" "}
            <DetailMetaTime date={maintenance.from} />
          </DetailMetaItem>
          <DetailMetaItem>
            {status === "completed" ? "Lasted" : "Lasts"}{" "}
            <span className="text-foreground font-mono">
              {formatDistanceStrict(maintenance.from, maintenance.to)}
            </span>
          </DetailMetaItem>
        </DetailMeta>
      </DetailHeader>
      <DetailContent>
        <DetailMain>
          <DetailSection>
            <DetailSectionTitle variant="heading">Message</DetailSectionTitle>
            <MaintenanceComposer maintenance={maintenance} />
          </DetailSection>
          <DetailSection>
            <DetailSectionTitle variant="heading">Updates</DetailSectionTitle>
            <FormCardGroup>
              {updates.map((update, index) => (
                <FormSheetWithDirtyProtection key={update.id}>
                  <FormMaintenanceUpdateCard
                    index={index}
                    total={updates.length}
                    update={update}
                    onSubmit={async (values) => {
                      await editUpdate.mutateAsync({
                        id: update.id,
                        message: values.message,
                        date: values.date,
                      });
                    }}
                    onDelete={async () => {
                      await deleteUpdate.mutateAsync({ id: update.id });
                    }}
                  />
                </FormSheetWithDirtyProtection>
              ))}
            </FormCardGroup>
            <FormSheetMaintenanceUpdate
              onSubmit={async (values) => {
                await createUpdate.mutateAsync({
                  maintenanceId: maintenance.id,
                  message: values.message,
                  date: values.date,
                  notifySubscribers: values.notifySubscribers,
                });
              }}
            >
              <Button size="sm" variant="outline">
                <Add />
                Add update
              </Button>
            </FormSheetMaintenanceUpdate>
          </DetailSection>
        </DetailMain>
        <DetailAside>
          <DetailSection>
            <DetailSectionTitle>Properties</DetailSectionTitle>
            <MaintenanceProperties
              maintenance={maintenance}
              page={page}
              status={status}
              publicUrl={publicUrl}
            />
          </DetailSection>
          <DetailSection>
            <DetailSectionTitle>Affected components</DetailSectionTitle>
            <MaintenanceComponents
              maintenance={maintenance}
              components={page.pageComponents}
              groups={page.pageComponentGroups}
            />
          </DetailSection>
          <DetailSection>
            <DetailSectionTitle>Notifications</DetailSectionTitle>
            <Notifications pageId={pageId} />
          </DetailSection>
        </DetailAside>
      </DetailContent>
    </SectionGroup>
  );
}
