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
import { useParams } from "next/navigation";
import { toast } from "sonner";

export default function VerifyPage() {
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
        toast.success("Unsubscribed successfully");
      },
      onError: (error) => {
        if (isTRPCClientError(error)) {
          toast.error(error.message);
        } else {
          toast.error("Failed to unsubscribe");
        }
      },
    }),
  );

  // FIXME: better handle !subscription case by prefetching it first
  if (!subscription) return null;

  // TODO: think of adding info about: acceptedAt, unsubscribedAt...

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-row items-center justify-between gap-2 py-0.5">
        <ButtonBack href="../" />
      </div>
      <FormCard>
        <FormCardHeader>
          <FormCardTitle>{subscription.email}</FormCardTitle>
          <FormCardDescription>
            Manage your subscription to receive updates on the status page.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardContent>
          <FormManageSubscription
            id="manage-subscription-form"
            defaultValues={{
              pageComponents: subscription?.componentIds ?? [],
              subscribeComponents:
                (subscription?.componentIds?.length ?? 0) > 0,
            }}
            page={page}
            onSubmit={async (values) => {
              manageSubscriptionMutation.mutate({
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
                Unsubscribed on{" "}
                {Intl.DateTimeFormat("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }).format(subscription.unsubscribedAt)}
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
                    ? "Unsubscribing..."
                    : "Unsubscribe"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unsubscribe</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to unsubscribe from this status page?
                    You will no longer receive updates.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      unsubscribeMutation.mutate({ token, domain })
                    }
                  >
                    Unsubscribe
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
                ? "Submitting..."
                : "Submit"}
            </Button>
          </div>
        </FormCardFooter>
      </FormCard>
    </div>
  );
}
