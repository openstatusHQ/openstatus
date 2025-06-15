"use client";

import { FormCardGroup } from "@/components/forms/form-card";
import { FormDangerZone } from "./form-danger-zone";
import { FormGeneral } from "./form-general";
import { FormNotifiers } from "./form-notifiers";
import { FormOtel } from "./form-otel";
import { FormResponseTime } from "./form-response-time";
import { FormRetry, RETRY_DEFAULT } from "./form-retry";
import { FormSchedulingRegions } from "./form-scheduling-regions";
import { FormStatusPages } from "./form-status-pages";
import { FormTags } from "./form-tags";
import { FormVisibility } from "./form-visibility";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useParams } from "next/navigation";

export function FormMonitorUpdate() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: monitor, refetch } = useQuery(
    trpc.monitor.get.queryOptions({ id: parseInt(id) })
  );
  const updateRetryMutation = useMutation(
    trpc.monitor.updateRetry.mutationOptions({
      onSuccess: () => refetch(),
    })
  );
  const updateOtelMutation = useMutation(
    trpc.monitor.updateOtel.mutationOptions({
      onSuccess: () => refetch(),
    })
  );
  const updatePublicMutation = useMutation(
    trpc.monitor.updatePublic.mutationOptions({
      onSuccess: () => refetch(),
    })
  );
  const updateSchedulingRegionsMutation = useMutation(
    trpc.monitor.updateSchedulingRegions.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  if (!monitor) return null;

  return (
    <FormCardGroup>
      <FormGeneral />
      <FormResponseTime />
      <FormTags />
      <FormSchedulingRegions
        defaultValues={{
          regions: monitor.regions,
          periodicity: monitor.periodicity,
        }}
        onSubmit={async (values) => {
          await updateSchedulingRegionsMutation.mutateAsync({
            id: parseInt(id),
            regions: values.regions,
            periodicity: values.periodicity,
          });
        }}
      />
      <FormStatusPages />
      <FormNotifiers />
      <FormRetry
        defaultValues={{
          retry: monitor.retry ?? RETRY_DEFAULT,
        }}
        onSubmit={async (values) =>
          await updateRetryMutation.mutateAsync({
            id: parseInt(id),
            retry: values.retry,
          })
        }
      />
      <FormOtel
        defaultValues={{
          endpoint: monitor.otelEndpoint ?? "",
          // headers: monitor.otelHeaders ?? [],
          headers: [],
        }}
        onSubmit={async (values) => {
          await updateOtelMutation.mutateAsync({
            id: parseInt(id),
            otelEndpoint: values.endpoint,
            otelHeaders: values.headers,
          });
        }}
      />
      <FormVisibility
        defaultValues={{
          visibility: monitor.public ?? false,
        }}
        onSubmit={async (values) => {
          await updatePublicMutation.mutateAsync({
            id: parseInt(id),
            public: values.visibility,
          });
        }}
      />
      <FormDangerZone />
    </FormCardGroup>
  );
}
