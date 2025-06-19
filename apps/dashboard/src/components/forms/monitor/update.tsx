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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useParams, useRouter } from "next/navigation";

export function FormMonitorUpdate() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
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
  const updateResponseTimeMutation = useMutation(
    trpc.monitor.updateResponseTime.mutationOptions({
      onSuccess: () => refetch(),
    })
  );
  const updateTagsMutation = useMutation(
    trpc.monitor.updateTags.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  const updateGeneralMutation = useMutation(
    trpc.monitor.updateGeneral.mutationOptions({
      onSuccess: () => {
        // NOTE: invalidate the list query to update the monitor in the list (especially the name)
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
        refetch();
      },
    })
  );

  const deleteMonitorMutation = useMutation(
    trpc.monitor.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
        router.push("/monitors");
      },
    })
  );

  if (!monitor) return null;

  return (
    <FormCardGroup>
      <FormGeneral
        defaultValues={{
          type: monitor.jobType as "http" | "tcp",
          url: monitor.url,
          name: monitor.name,
          method: monitor.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
          headers: monitor.headers ?? [],
          body: monitor.body,
          assertions: [],
        }}
        onSubmit={async (values) => {
          await updateGeneralMutation.mutateAsync({
            id: parseInt(id),
            name: values.name,
            jobType: values.type,
            url: values.url,
            method: values.method,
            headers: values.headers,
            body: values.body,
            // assertions: values.assertions,
          });
        }}
      />
      <FormResponseTime
        defaultValues={{
          timeout: monitor.timeout,
          degradedAfter: monitor.degradedAfter ?? undefined,
        }}
        onSubmit={async (values) => {
          await updateResponseTimeMutation.mutateAsync({
            id: parseInt(id),
            timeout: values.timeout,
            degradedAfter: values.degradedAfter ?? undefined,
          });
        }}
      />
      <FormTags
        defaultValues={{
          tags: monitor.tags,
        }}
        onSubmit={async (values) => {
          await updateTagsMutation.mutateAsync({
            id: parseInt(id),
            tags: values.tags.map((tag) => tag.id),
          });
        }}
      />
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
      <FormDangerZone
        onSubmit={async () => {
          await deleteMonitorMutation.mutateAsync({ id: parseInt(id) });
        }}
      />
    </FormCardGroup>
  );
}
