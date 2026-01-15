"use client";

import {
  StatusBlankContainer,
  StatusBlankContent,
  StatusBlankDescription,
  StatusBlankLink,
  StatusBlankTitle,
} from "@/components/status-page/status-blank";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function UnsubscribePage() {
  const trpc = useTRPC();
  const { token, domain } = useParams<{ token: string; domain: string }>();

  const subscriberQuery = useQuery(
    trpc.statusPage.getSubscriberByToken.queryOptions({ token }),
  );

  const unsubscribeMutation = useMutation(
    trpc.statusPage.unsubscribe.mutationOptions({}),
  );

  const handleUnsubscribe = () => {
    unsubscribeMutation.mutate({ token });
  };

  // Loading state
  if (subscriberQuery.isLoading) {
    return (
      <StatusBlankContainer>
        <StatusBlankContent>
          <StatusBlankTitle>Loading...</StatusBlankTitle>
        </StatusBlankContent>
      </StatusBlankContainer>
    );
  }

  // Invalid/expired token or already unsubscribed
  if (!subscriberQuery.data) {
    return (
      <StatusBlankContainer>
        <StatusBlankContent>
          <StatusBlankTitle className="text-destructive">
            Invalid or expired link
          </StatusBlankTitle>
          <StatusBlankDescription>
            This unsubscribe link is no longer valid. You may have already
            unsubscribed.
          </StatusBlankDescription>
          <StatusBlankLink href="../">Go back</StatusBlankLink>
        </StatusBlankContent>
      </StatusBlankContainer>
    );
  }

  // Success state after unsubscribing
  if (unsubscribeMutation.isSuccess) {
    return (
      <StatusBlankContainer>
        <StatusBlankContent>
          <StatusBlankTitle className="text-success">
            Successfully unsubscribed
          </StatusBlankTitle>
          <StatusBlankDescription>
            You will no longer receive email notifications from{" "}
            {subscriberQuery.data.pageName}.
          </StatusBlankDescription>
          <StatusBlankLink href="../">Go back</StatusBlankLink>
        </StatusBlankContent>
      </StatusBlankContainer>
    );
  }

  // Error state
  if (unsubscribeMutation.isError) {
    return (
      <StatusBlankContainer>
        <StatusBlankContent>
          <StatusBlankTitle className="text-destructive">
            {unsubscribeMutation.error?.message || "Something went wrong"}
          </StatusBlankTitle>
          <StatusBlankDescription>
            Please try again or contact support if the issue persists.
          </StatusBlankDescription>
          <StatusBlankLink href="../">Go back</StatusBlankLink>
        </StatusBlankContent>
      </StatusBlankContainer>
    );
  }

  // Confirmation state (initial view)
  return (
    <StatusBlankContainer>
      <StatusBlankContent>
        <StatusBlankTitle>Unsubscribe from notifications</StatusBlankTitle>
        <StatusBlankDescription>
          You are about to unsubscribe{" "}
          <span className="font-semibold">{subscriberQuery.data.maskedEmail}</span>{" "}
          from <span className="font-semibold">{subscriberQuery.data.pageName}</span>{" "}
          status updates.
        </StatusBlankDescription>
        <div className="flex gap-2 pt-2">
          <StatusBlankLink href="../">Cancel</StatusBlankLink>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleUnsubscribe}
            disabled={unsubscribeMutation.isPending}
          >
            {unsubscribeMutation.isPending ? "Unsubscribing..." : "Confirm Unsubscribe"}
          </Button>
        </div>
      </StatusBlankContent>
    </StatusBlankContainer>
  );
}
