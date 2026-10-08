"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/components/common/link";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";
import { switchWorkspace } from "@/lib/workspace-cookie";

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
        switchWorkspace(workspace.slug);
      },
    }),
  );

  // TODO: check if we can have a high level wrapper for isTRPCClientError errors
  if (isTRPCClientError(error)) {
    return (
      <SectionGroup>
        <Section>
          <SectionHeader>
            <SectionTitle>Invitation</SectionTitle>
            <SectionDescription>
              This invitation can&apos;t be opened.
            </SectionDescription>
          </SectionHeader>
          <EmptyStateContainer className="py-8">
            <EmptyStateTitle>Invitation unavailable</EmptyStateTitle>
            <EmptyStateDescription className="font-mono">
              {error.message}
            </EmptyStateDescription>
            <Button size="sm" variant="outline" className="mt-2" asChild>
              <Link href="/overview">Back to overview</Link>
            </Button>
          </EmptyStateContainer>
        </Section>
      </SectionGroup>
    );
  }

  if (!invitation) return null;
  if (invitation.acceptedAt) return null;

  const { workspace } = invitation;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Invitation</SectionTitle>
          <SectionDescription>
            Accepting switches you into the workspace. You can switch back
            anytime from the sidebar.
          </SectionDescription>
        </SectionHeader>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Join workspace</FormCardTitle>
            <FormCardDescription>
              You were invited as{" "}
              <span className="text-foreground font-mono">
                {invitation.role}
              </span>{" "}
              via{" "}
              <span className="text-foreground font-mono">
                {invitation.email}
              </span>
              .
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            <div className="flex items-center gap-3">
              <div className="size-8 shrink-0 overflow-hidden rounded-lg">
                <img
                  src={`https://api.dicebear.com/9.x/glass/svg?seed=${workspace.slug}`}
                  alt=""
                />
              </div>
              <div className="grid min-w-0 text-sm leading-tight">
                <div className="truncate font-medium">
                  {workspace.name || "Untitled Workspace"}
                </div>
                <div className="truncate text-xs">
                  <span className="font-commit-mono tracking-tight">
                    {workspace.slug}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {workspace.plan === "team" ? "pro" : workspace.plan}
                  </span>
                </div>
              </div>
            </div>
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Invitation expires {formatDate(invitation.expiresAt)}.
            </FormCardFooterInfo>
            <Button
              size="sm"
              disabled={isPending}
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
          </FormCardFooter>
        </FormCard>
      </Section>
    </SectionGroup>
  );
}
