"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { FormCardGroup } from "@/components/forms/form-card";
import { formatSlaTarget, parseSlaTarget } from "@/data/reportings.client";
import { useTRPC } from "@/lib/trpc/client";

import { FormCommitment } from "./form-commitment";
import { FormCredits } from "./form-credits";
import { FormMonitors } from "./form-monitors";
import { FormSupportTerms } from "./form-support-terms";

export function FormMonitorReportingUpdate() {
  const { id } = useParams<{ id: string }>();
  const policyId = Number.parseInt(id);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: policy } = useQuery(
    trpc.monitorReporting.summary.queryOptions({ id: policyId }),
  );
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const { data: incidentPolicy, isPending: incidentPending } = useQuery(
    trpc.incidentReporting.get.queryOptions(),
  );
  const updateMutation = useMutation(
    trpc.monitorReporting.update.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.monitorReporting.pathKey(),
        }),
    }),
  );

  if (!policy || !monitors || incidentPending) return null;

  return (
    <FormCardGroup>
      <FormCommitment
        defaultValues={{
          name: policy.name,
          target: formatSlaTarget(policy.target),
          strict: policy.strict,
          timeZone: policy.timeZone,
        }}
        live={{ month: policy.liveMonth, ...policy.liveTerms }}
        timeZoneLocked={policy.sealed}
        onSubmit={async (values) => {
          const target = parseSlaTarget(values.target);
          if (target === null) return;
          await updateMutation.mutateAsync({
            id: policyId,
            name: values.name,
            target,
            strict: values.strict,
            timeZone: values.timeZone,
          });
        }}
      />
      <FormMonitors
        defaultValues={{ monitorIds: policy.monitors.map((m) => m.id) }}
        monitors={monitors}
        strict={policy.strict}
        onSubmit={async (values) => {
          await updateMutation.mutateAsync({
            id: policyId,
            monitorIds: values.monitorIds,
          });
        }}
      />
      <FormCredits
        schedule={policy.creditSchedule}
        slaTarget={policy.target}
        live={{
          month: policy.liveMonth,
          creditSchedule: policy.liveTerms.creditSchedule,
        }}
        onSubmit={async (creditSchedule) => {
          await updateMutation.mutateAsync({ id: policyId, creditSchedule });
        }}
      />
      <FormSupportTerms
        // remount so the switch follows a link made or lost elsewhere
        key={`${policy.incidentSlaPolicyId}-${incidentPolicy?.id}`}
        incidentPolicy={incidentPolicy ?? null}
        linked={
          policy.incidentSlaPolicyId !== null &&
          policy.incidentSlaPolicyId === incidentPolicy?.id
        }
        holder={policy.incidentLinkHolder}
        onSubmit={async (incidentSlaPolicyId) => {
          await updateMutation.mutateAsync({
            id: policyId,
            incidentSlaPolicyId,
          });
        }}
      />
    </FormCardGroup>
  );
}
