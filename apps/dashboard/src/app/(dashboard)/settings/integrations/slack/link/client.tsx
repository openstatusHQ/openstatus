"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";

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
import { useTRPC } from "@/lib/trpc/client";
import { switchWorkspace } from "@/lib/workspace-cookie";

import { searchParamsParsers } from "./search-params";

function Message({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <EmptyStateContainer className="py-8">
      <EmptyStateTitle>{title}</EmptyStateTitle>
      <EmptyStateDescription>{description}</EmptyStateDescription>
      <div className="mt-2 flex gap-2">
        {children}
        <Button size="sm" variant="outline" asChild>
          <Link href="/settings/integrations">Back to integrations</Link>
        </Button>
      </div>
    </EmptyStateContainer>
  );
}

export function Client() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [{ token }] = useQueryStates(searchParamsParsers);
  const previewQuery = useQuery({
    ...trpc.slackUser.previewLink.queryOptions({ token }),
    retry: false,
  });
  const preview = previewQuery.data;
  const link = useMutation(
    trpc.slackUser.link.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.slackUser.list.queryKey(),
        }),
    }),
  );

  const body = (() => {
    if (previewQuery.isPending) {
      return <p className="text-muted-foreground text-sm">Checking link…</p>;
    }
    if (previewQuery.isError || !preview) {
      return (
        <Message
          title="Could not check this link"
          description="Reload the page to try again."
        />
      );
    }
    if (link.isSuccess) {
      return (
        <Message
          title="Slack account linked"
          description="You can go back to Slack and use openstatus there."
        />
      );
    }
    switch (preview.status) {
      case "invalid":
        return (
          <Message
            title="Link expired"
            description="This link is invalid or has expired. Ask openstatus in Slack for a new one."
          />
        );
      case "not-member":
        return (
          <Message
            title="Not a member"
            description="This Slack workspace is connected to an openstatus workspace you are not a member of. Ask an admin to invite you."
          />
        );
      case "wrong-workspace":
        return (
          <Message
            title={`Switch to ${preview.workspaceName ?? preview.workspaceSlug}`}
            description="This link belongs to another of your workspaces."
          >
            <Button
              size="sm"
              onClick={() =>
                switchWorkspace(preview.workspaceSlug, window.location.href)
              }
            >
              Switch workspace
            </Button>
          </Message>
        );
      case "ready":
        return (
          <Message
            title="Link your Slack account"
            description={`Link your Slack account to ${preview.workspaceName ?? "this workspace"} so you can use openstatus in Slack.`}
          >
            <Button
              size="sm"
              onClick={() => link.mutate({ token })}
              disabled={link.isPending}
            >
              {link.isPending ? "Linking..." : "Link account"}
            </Button>
          </Message>
        );
    }
  })();

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Slack</SectionTitle>
          <SectionDescription>
            Only members of this workspace can use openstatus in Slack.
          </SectionDescription>
        </SectionHeader>
        {link.error ? (
          <Message title="Could not link" description={link.error.message} />
        ) : (
          body
        )}
      </Section>
    </SectionGroup>
  );
}
