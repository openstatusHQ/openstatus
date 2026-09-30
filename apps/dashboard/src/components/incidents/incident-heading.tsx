"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { toast } from "sonner";

import {
  DetailActions,
  DetailDescription,
  DetailInput,
  DetailTitle,
  DetailTitleRow,
} from "@/components/content/detail";
import { useTRPC } from "@/lib/trpc/client";

import { useInvalidateIncident } from "./use-invalidate-incident";

type Incident = NonNullable<RouterOutputs["incident"]["get"]>;

export function IncidentHeading({
  incident,
  actions,
}: {
  incident: Incident;
  actions?: React.ReactNode;
}) {
  const trpc = useTRPC();
  const invalidate = useInvalidateIncident(incident.id);
  const update = useMutation(
    trpc.incident.update.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => {
        toast.error(
          isTRPCClientError(error) ? error.message : "Failed to save",
        );
      },
    }),
  );

  if (incident.closedAt !== null) {
    return (
      <>
        <DetailTitleRow>
          <DetailTitle>{incident.title}</DetailTitle>
          {actions ? <DetailActions>{actions}</DetailActions> : null}
        </DetailTitleRow>
        {incident.summary ? (
          <DetailDescription className="whitespace-pre-wrap">
            {incident.summary}
          </DetailDescription>
        ) : null}
      </>
    );
  }

  return (
    <>
      <DetailTitleRow>
        <DetailTitle>
          <DetailInput
            aria-label="Title"
            required
            maxLength={256}
            value={incident.title}
            onCommit={(title) => update.mutate({ id: incident.id, title })}
          />
        </DetailTitle>
        {actions ? <DetailActions>{actions}</DetailActions> : null}
      </DetailTitleRow>
      <DetailDescription>
        <DetailInput
          multiline
          aria-label="Summary"
          placeholder="Add a summary…"
          maxLength={4000}
          value={incident.summary ?? ""}
          onCommit={(summary) =>
            update.mutate({ id: incident.id, summary: summary || null })
          }
        />
      </DetailDescription>
    </>
  );
}
