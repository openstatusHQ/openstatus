"use client";

import {
  StatusBlankContainer,
  StatusBlankContent,
  StatusBlankDescription,
  StatusBlankLink,
  StatusBlankTitle,
} from "@/components/status-page/status-blank";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useExtracted } from "next-intl";
import { useParams } from "next/navigation";

export default function UnsubscribePage() {
  const t = useExtracted();
  const trpc = useTRPC();
  const { token, domain } = useParams<{ token: string; domain: string }>();

  const subscriberQuery = useQuery(
    trpc.statusPage.getSubscriberByToken.queryOptions({ token, domain }),
  );

  const unsubscribeMutation = useMutation(
    trpc.statusPage.unsubscribe.mutationOptions({}),
  );

  const handleUnsubscribe = () => {
    unsubscribeMutation.mutate({ token, domain });
  };

  // Loading state
  if (subscriberQuery.isLoading) {
    return (
      <StatusBlankContainer>
        <StatusBlankContent>
          <StatusBlankTitle>{t("Loading...")}</StatusBlankTitle>
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
            {t("Invalid or expired link")}
          </StatusBlankTitle>
          <StatusBlankDescription>
            {t(
              "This unsubscribe link is no longer valid. You may have already unsubscribed.",
            )}
          </StatusBlankDescription>
          <StatusBlankLink href="../">{t("Go back")}</StatusBlankLink>
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
            {t("Successfully unsubscribed")}
          </StatusBlankTitle>
          <StatusBlankDescription>
            {t(
              "You will no longer receive email notifications from {pageName}.",
              { pageName: subscriberQuery.data.pageName },
            )}
          </StatusBlankDescription>
          <StatusBlankLink href="../">{t("Go back")}</StatusBlankLink>
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
            {unsubscribeMutation.error?.message || t("Something went wrong")}
          </StatusBlankTitle>
          <StatusBlankDescription>
            {t("Please try again or contact support if the issue persists.")}
          </StatusBlankDescription>
          <StatusBlankLink href="../">{t("Go back")}</StatusBlankLink>
        </StatusBlankContent>
      </StatusBlankContainer>
    );
  }

  // Confirmation state (initial view)
  return (
    <StatusBlankContainer>
      <StatusBlankContent>
        <StatusBlankTitle>
          {t("Unsubscribe from notifications")}
        </StatusBlankTitle>
        <StatusBlankDescription>
          {t(
            "You are about to unsubscribe {email} from {pageName} status updates.",
            {
              email: subscriberQuery.data.maskedEmail ?? "",
              pageName: subscriberQuery.data.pageName ?? "",
            },
          )}
        </StatusBlankDescription>
        <div className="flex justify-center gap-2">
          <StatusBlankLink href="../">{t("Cancel")}</StatusBlankLink>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleUnsubscribe}
            disabled={unsubscribeMutation.isPending}
          >
            {unsubscribeMutation.isPending
              ? t("Unsubscribing...")
              : t("Unsubscribe")}
          </Button>
        </div>
      </StatusBlankContent>
    </StatusBlankContainer>
  );
}
