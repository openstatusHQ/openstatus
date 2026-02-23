"use client";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { useTRPC } from "@/lib/trpc/client";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

const SERVER_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.openstatus.dev"
    : "http://localhost:3000";

interface SlackIntegrationCardProps {
  integration: {
    id: number;
    externalId: string;
    data: { teamName?: string };
  } | null;
}

export function SlackIntegrationCard({
  integration,
}: SlackIntegrationCardProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isConnected = !!integration;

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

  const handleInstall = () => {
    generateToken.mutate();
  };

  const handleDisconnect = () => {
    if (!integration) return;
    deleteIntegration.mutate({ integrationId: integration.id });
  };

  return (
    <FormCard>
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
          <p className="text-muted-foreground text-sm">
            Connected to{" "}
            <strong>{integration.data?.teamName ?? "Slack workspace"}</strong>
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Connect your Slack workspace to get started.
          </p>
        )}
      </FormCardContent>
      <FormCardFooter>
        {isConnected ? (
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
