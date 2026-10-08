"use client";

import { Lock } from "@openstatus/icons";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Link } from "@/components/common/link";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
  FormCardUpgrade,
} from "@/components/forms/form-card";
import { useTRPC } from "@/lib/trpc/client";

const SERVER_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.openstatus.dev"
    : "http://localhost:3000";

interface SlackIntegrationCardProps {
  locked?: boolean;
  integration: {
    id: number;
    externalId: string;
    data: { teamName?: string };
    missingScopes: string[];
  } | null;
}

export function SlackIntegrationCard({
  locked,
  integration,
}: SlackIntegrationCardProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isConnected = !!integration;
  const needsReconnect = (integration?.missingScopes.length ?? 0) > 0;

  const deleteIntegration = useMutation(
    trpc.integrationRouter.deleteIntegration.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.integrationRouter.list.queryKey(),
        });
        router.refresh();
      },
    }),
  );

  const generateToken = useMutation(
    trpc.integrationRouter.generateInstallToken.mutationOptions({
      onSuccess: (data) => {
        window.location.href = `${SERVER_URL}/slack/install?token=${data.token}`;
      },
    }),
  );

  const linkedAccountsQuery = useQuery({
    ...trpc.slackUser.list.queryOptions(),
    enabled: isConnected,
  });
  const linkedAccounts = linkedAccountsQuery.data;

  const handleInstall = () => {
    generateToken.mutate();
  };

  const handleDisconnect = () => {
    if (!integration) return;
    deleteIntegration.mutate({ integrationId: integration.id });
  };

  return (
    <FormCard>
      {locked ? <FormCardUpgrade /> : null}
      <FormCardHeader>
        <div className="flex items-center gap-2">
          <FormCardTitle>Slack</FormCardTitle>
          {isConnected && <Badge variant="secondary">Connected</Badge>}
        </div>
        <FormCardDescription>
          Manage status reports directly from Slack. Mention the bot in a
          channel to create and update incidents.
        </FormCardDescription>
      </FormCardHeader>
      <FormCardContent>
        {isConnected ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Connected to{" "}
              <strong>{integration.data?.teamName ?? "Slack workspace"}</strong>
              . Only members with a linked Slack account can use it.
            </p>
            {needsReconnect ? (
              <div className="border-warning/40 flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span className="text-warning">
                  Reconnect Slack to enable incident channels.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleInstall}
                  disabled={generateToken.isPending}
                >
                  Reconnect
                </Button>
              </div>
            ) : null}
            {linkedAccountsQuery.isPending ? (
              <p className="text-muted-foreground text-sm">
                Loading linked accounts…
              </p>
            ) : linkedAccountsQuery.isError ? (
              <p className="text-destructive text-sm">
                Could not load linked accounts. Reload the page to try again.
              </p>
            ) : linkedAccounts?.length ? (
              <ul className="space-y-1 text-sm">
                {linkedAccounts.map((account) => (
                  <li
                    key={account.id}
                    className="text-muted-foreground font-mono"
                  >
                    Linked Slack user {account.slackUserId}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Your Slack account links itself the first time you use
                openstatus in Slack, when its email matches your openstatus
                email.
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Connect your Slack workspace to get started.
          </p>
        )}
      </FormCardContent>
      <FormCardFooter>
        <FormCardFooterInfo>
          Learn more about{" "}
          <Link
            href="https://www.openstatus.dev/blog/openstatus-slack-agent"
            rel="noreferrer"
            target="_blank"
          >
            Slack Agent
          </Link>
          .
        </FormCardFooterInfo>
        {locked ? (
          <Button
            data-track="paywall_viewed"
            data-limit="slack-agent"
            type="button"
            asChild
          >
            <Link href="/settings/billing">
              <Lock />
              Upgrade
            </Link>
          </Button>
        ) : isConnected ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDisconnect}
            disabled={deleteIntegration.isPending}
          >
            {deleteIntegration.isPending ? "Disconnecting..." : "Disconnect"}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleInstall}
            disabled={generateToken.isPending}
          >
            {generateToken.isPending ? "Connecting..." : "Add to Slack"}
          </Button>
        )}
      </FormCardFooter>
    </FormCard>
  );
}
