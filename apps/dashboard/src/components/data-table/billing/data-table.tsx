"use client";

import { Check } from "lucide-react";
import { Fragment, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { plans, config as featureGroups } from "@/data/plans";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/lib/trpc/client";
import { getStripe } from "@/lib/stripe";
import { useMutation, useQuery } from "@tanstack/react-query";

const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://app.openstatus.dev"
    : "http://localhost:3000";

export function DataTable() {
  const trpc = useTRPC();
  const [isPending, startTransition] = useTransition();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

  const checkoutSessionMutation = useMutation(
    trpc.stripeRouter.getCheckoutSession.mutationOptions({
      onSuccess: async (data) => {
        if (!data) return;

        const stripe = await getStripe();
        stripe?.redirectToCheckout({ sessionId: data.id });
      },
    })
  );

  if (!workspace) return null;

  return (
    <Table className="relative table-fixed">
      <TableCaption>
        A list to compare the different features by plan.
      </TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="p-2 align-bottom">
            Features comparison
          </TableHead>
          {Object.values(plans).map(({ id, ...plan }) => {
            const isCurrentPlan = workspace.plan === id;
            return (
              <TableHead
                key={id}
                className={cn(
                  "h-px p-2 align-top text-foreground",
                  id === "starter" ? "bg-muted/30" : ""
                )}
              >
                <div className="flex h-full flex-col justify-between gap-1">
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="font-cal text-lg">{plan.title}</p>
                    <p className="text-wrap font-normal text-muted-foreground text-xs">
                      {plan.description}
                    </p>
                  </div>
                  <p className="text-right">
                    <span className="font-cal text-lg">{plan.price}€</span>{" "}
                    <span className="font-light text-muted-foreground text-sm">
                      /month
                    </span>
                  </p>
                  <Button
                    size="sm"
                    variant={id === "starter" ? "default" : "outline"}
                    onClick={() => {
                      startTransition(async () => {
                        await checkoutSessionMutation.mutateAsync({
                          plan: id,
                          // TODO: move to the server as we have the current workspace
                          workspaceSlug: workspace.slug,
                          successUrl: `${BASE_URL}/settings/billing?success=true`,
                          cancelUrl: `${BASE_URL}/settings/billing`,
                        });
                      });
                    }}
                    disabled={isPending || isCurrentPlan}
                  >
                    {isCurrentPlan
                      ? "Current Plan"
                      : isPending
                        ? "Choosing..."
                        : "Choose"}
                  </Button>
                </div>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(featureGroups).map(
          ([groupKey, { label, features }]) => (
            <Fragment key={groupKey}>
              <TableRow className="bg-muted/50">
                <TableCell
                  colSpan={Object.keys(plans).length + 1}
                  className="font-medium"
                >
                  {label}
                </TableCell>
              </TableRow>
              {features.map(({ value, label: featureLabel, monthly }) => (
                <TableRow key={groupKey + value}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {featureLabel}
                    </div>
                  </TableCell>
                  {Object.values(plans).map((plan) => {
                    const limitValue =
                      plan.limits[value as keyof typeof plan.limits];

                    function renderContent() {
                      if (typeof limitValue === "boolean") {
                        return limitValue ? (
                          <Check className="h-4 w-4 text-foreground" />
                        ) : (
                          <span className="text-muted-foreground/50">
                            &#8208;
                          </span>
                        );
                      }
                      if (typeof limitValue === "number") {
                        return new Intl.NumberFormat("us")
                          .format(limitValue)
                          .toString();
                      }
                      if (Array.isArray(limitValue) && limitValue.length > 0) {
                        return limitValue[0];
                      }
                      return limitValue;
                    }

                    return (
                      <TableCell
                        key={plan.id + value}
                        className={cn(
                          "font-mono",
                          plan.id === "starter" && "bg-muted/30"
                        )}
                      >
                        {renderContent()}
                        {monthly ? "/mo" : ""}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </Fragment>
          )
        )}
      </TableBody>
    </Table>
  );
}
