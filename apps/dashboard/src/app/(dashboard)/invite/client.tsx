"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { toast } from "sonner";
import { searchParamsParsers } from "./search-params";

export function Client() {
  const trpc = useTRPC();
  const [isPending, startTransition] = useTransition();
  const [{ token }] = useQueryStates(searchParamsParsers);
  const { data: invitation, error } = useQuery({
    ...trpc.invitation.get.queryOptions({ token }),
    retry: false,
  });
  const acceptInvitationMutation = useMutation(
    trpc.invitation.accept.mutationOptions({
      onSuccess: (workspace) => {
        if (!workspace) return;
        document.cookie = `workspace-slug=${workspace.slug}; path=/;`;
        window.location.href = "/overview";
      },
    }),
  );

  // TODO: check if we can have a high level wrapper for isTRPCClientError errors
  if (isTRPCClientError(error)) {
    return (
      <SectionGroup>
        <Section>
          <SectionHeader>
            <SectionTitle className="text-destructive">Error</SectionTitle>
            <SectionDescription className="font-mono">
              {error.message}
            </SectionDescription>
          </SectionHeader>
        </Section>
      </SectionGroup>
    );
  }

  if (!invitation) return null;
  if (invitation.acceptedAt) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Invitation</SectionTitle>
          <SectionDescription>
            You&apos;ve been invited to join the workspace
            {invitation.workspace.name ? (
              <span className="font-semibold">{` ${invitation.workspace.name}`}</span>
            ) : (
              ""
            )}
            .
          </SectionDescription>
        </SectionHeader>
        <Button
          size="sm"
          onClick={() => {
            startTransition(async () => {
              try {
                const promise = acceptInvitationMutation.mutateAsync({
                  id: invitation.id,
                });
                toast.promise(promise, {
                  loading: "Accepting invitation...",
                  success: "Invitation accepted",
                  error: (error) => {
                    if (isTRPCClientError(error)) {
                      return error.message;
                    }
                    return "Failed to accept invitation";
                  },
                });
                await promise;
              } catch (error) {
                console.error(error);
              }
            });
          }}
        >
          {isPending ? "Accepting..." : "Accept Invitation"}
        </Button>
      </Section>
    </SectionGroup>
  );
}
