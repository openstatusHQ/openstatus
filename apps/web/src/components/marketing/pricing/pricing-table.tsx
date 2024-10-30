"use client";

import { Check, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment } from "react";

import { workspacePlans } from "@openstatus/db/src/schema/workspaces/constants";
import type { WorkspacePlan } from "@openstatus/db/src/schema/workspaces/validation";
import { Badge } from "@openstatus/ui/src/components/badge";
import { Button } from "@openstatus/ui/src/components/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/src/components/table";
import { pricingTableConfig } from "../../../config/pricing-table";

import { LoadingAnimation } from "@/components/loading-animation";
import { cn } from "@/lib/utils";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

export function PricingTable({
  plans = workspacePlans,
  currentPlan,
  events,
  isLoading,
}: {
  plans?: readonly WorkspacePlan[];
  currentPlan?: WorkspacePlan;
  events?: Partial<Record<WorkspacePlan, () => void>>;
  isLoading?: boolean;
}) {
  const router = useRouter();
  const selectedPlans = Object.entries(allPlans)
    .filter(([key, _]) => plans.includes(key as keyof typeof allPlans))
    .map(([key, value]) => ({ key: key as keyof typeof allPlans, ...value }));
  return (
    <Table className="relative">
      <TableCaption>
        A list to compare the different features by plan.
      </TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-background">
          <TableHead className="bg-background px-3 py-3 align-bottom">
            Features comparison
          </TableHead>
          {selectedPlans.map(({ key, ...plan }) => {
            const isCurrentPlan = key === currentPlan;
            return (
              <TableHead
                key={key}
                className={cn(
                  "h-auto px-3 py-3 align-bottom text-foreground",
                  key === "team" ? "bg-muted/30" : "bg-background",
                )}
              >
                <p className="sticky top-0 mb-2 font-cal text-2xl">
                  {plan.title}
                </p>
                <p className="mb-2 font-normal text-muted-foreground text-sm">
                  {plan.description}
                </p>
                <p className="mb-2 text-right">
                  <span className="font-cal text-xl">{plan.price}€</span>{" "}
                  <span className="font-light text-muted-foreground text-sm">
                    /month
                  </span>
                </p>
                <Button
                  className="w-full"
                  size="sm"
                  variant={key === "team" ? "default" : "outline"}
                  onClick={() => {
                    if (events?.[key]) {
                      return events[key]?.();
                    }
                    // FIXME: how to properly handle `?redirectTo` with unknown workspaceSlug
                    // to redirect user to `/app/[workspaceSlug]/settings/billing?plan=${key}`?
                    return router.push(`/app/login?plan=${key}`);
                  }}
                  disabled={isCurrentPlan || isLoading}
                >
                  {isLoading ? (
                    <LoadingAnimation
                      variant={key === "team" ? "default" : "inverse"}
                    />
                  ) : isCurrentPlan ? (
                    "Current plan"
                  ) : (
                    "Choose"
                  )}
                </Button>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(pricingTableConfig).map(
          ([key, { label, features }], _i) => {
            return (
              <Fragment key={key}>
                <TableRow className="bg-muted/50">
                  <TableCell
                    colSpan={selectedPlans.length + 1}
                    className="p-3 font-medium"
                  >
                    {label}
                  </TableCell>
                </TableRow>
                {features.map(
                  ({ label, value, badge, monthly, description }, _i) => {
                    return (
                      <TableRow key={key + label}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {label}
                            {badge ? (
                              <Badge variant="secondary">{badge}</Badge>
                            ) : null}
                            {description ? (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger className="ml-auto data-[state=closed]:text-muted-foreground">
                                    <Info className="h-4 w-4" />
                                  </TooltipTrigger>
                                  <TooltipContent className="w-64">
                                    {description}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : null}
                          </div>
                        </TableCell>
                        {selectedPlans.map((plan, _i) => {
                          const limitValue =
                            plan.limits[value as keyof typeof plan.limits];
                          function renderContent() {
                            if (typeof limitValue === "boolean") {
                              if (limitValue) {
                                return (
                                  <Check className="h-4 w-4 text-foreground" />
                                );
                              }
                              return (
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
                            if (
                              Array.isArray(limitValue) &&
                              limitValue.length > 0
                            ) {
                              return limitValue[0];
                            }
                            return limitValue;
                          }

                          return (
                            <TableCell
                              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                              key={key + value + _i}
                              className={cn(
                                "p-3 font-mono",
                                plan.key === "team" && "bg-muted/30",
                              )}
                            >
                              {renderContent()}
                              {monthly ? "/mo" : ""}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  },
                )}
              </Fragment>
            );
          },
        )}
      </TableBody>
    </Table>
  );
}
