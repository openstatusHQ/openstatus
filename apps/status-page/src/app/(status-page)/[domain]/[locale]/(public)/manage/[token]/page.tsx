"use client";

import { ButtonBack } from "@/components/button/button-back";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { FormManageSubscription } from "@/components/forms/form-manage-subscription";
import {
  StatusBlankContainer,
  StatusBlankContent,
  StatusBlankDescription,
  StatusBlankLink,
  StatusBlankTitle,
} from "@/components/status-page/status-blank";
import { useTRPC } from "@/lib/trpc/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@openstatus/ui/components/ui/alert-dialog";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useExtracted, useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { toast } from "sonner";

export default function VerifyPage() {
  const t = useExtracted();
  const locale = useLocale();
  const trpc = useTRPC();
  const { token, domain } = useParams<{ token: string; domain: string }>();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );
  const { data: subscription, refetch } = useQuery(
    trpc.statusPage.getSubscriptionByToken.queryOptions({
      slug: domain,
      token,
    }),
  );
  const manageSubscriptionMutation = useMutation(
    trpc.statusPage.updateSubscription.mutationOptions({}),
  );
  const unsubscribeMutation = useMutation(
    trpc.statusPage.unsubscribe.mutationOptions({
      onSuccess: () => {
        refetch();
        toast.success(t("Unsubscribed successfully"));
      },
      onError: (error) => {
        if (isTRPCClientError(error)) {
          toast.error(error.message);
        } else {
          toast.error(t("Failed to unsubscribe"));
        }
      },
    }),
  );

  if (!subscription)
    return (
      <StatusBlankContainer>
        <StatusBlankContent>
          <StatusBlankTitle>{t("Invalid subscription token")}</StatusBlankTitle>
          <StatusBlankDescription>
            {t(
              "This subscription token is no longer valid. You may have already unsubscribed or the link has expired.",
            )}
          </StatusBlankDescription>
          <StatusBlankLink href="../">{t("Go back")}</StatusBlankLink>
        </StatusBlankContent>
      </StatusBlankContainer>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-row items-center justify-between gap-2 py-0.5">
        <ButtonBack href="../" />
      </div>
      <FormCard>
        <FormCardHeader>
          <FormCardTitle>{subscription.email}</FormCardTitle>
          <FormCardDescription>
            {t(
              "Manage your subscription to receive updates on the status page.",
            )}
          </FormCardDescription>
        </FormCardHeader>
        <FormCardContent className="px-0">
          <FormManageSubscription
            id="manage-subscription-form"
            defaultValues={{
              pageComponents: subscription?.componentIds ?? [],
              subscribeComponents:
                (subscription?.componentIds?.length ?? 0) > 0,
            }}
            page={page}
            onSubmit={async (values) => {
              await manageSubscriptionMutation.mutateAsync({
                slug: domain,
                token,
                ...values,
              });
            }}
          />
        </FormCardContent>
        <FormCardFooter>
          <FormCardFooterInfo>
            {subscription.unsubscribedAt ? (
              <span className="text-destructive">
                {t("Unsubscribed on {date}", {
                  date: Intl.DateTimeFormat(locale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }).format(subscription.unsubscribedAt),
                })}
              </span>
            ) : null}
          </FormCardFooterInfo>
          <div className="flex flex-row gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/20 dark:hover:bg-destructive/10"
                  disabled={
                    unsubscribeMutation.isPending ||
                    !!subscription.unsubscribedAt
                  }
                >
                  {unsubscribeMutation.isPending
                    ? t("Unsubscribing...")
                    : t("Unsubscribe")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("Unsubscribe")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      "Are you sure you want to unsubscribe from this status page? You will no longer receive updates.",
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      unsubscribeMutation.mutate({ token, domain })
                    }
                  >
                    {t("Unsubscribe")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              size="sm"
              variant="outline"
              type="submit"
              form="manage-subscription-form"
              disabled={
                manageSubscriptionMutation.isPending ||
                !!subscription.unsubscribedAt
              }
            >
              {manageSubscriptionMutation.isPending
                ? t("Submitting...")
                : t("Submit")}
            </Button>
          </div>
        </FormCardFooter>
      </FormCard>
    </div>
  );
}
