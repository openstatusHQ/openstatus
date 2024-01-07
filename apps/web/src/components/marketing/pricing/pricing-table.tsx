"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import type { PlanName } from "@openstatus/plans";
import {
  allPlans,
  plans as defaultPlans,
  pricingTableConfig,
} from "@openstatus/plans";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { cn } from "@/lib/utils";

export function PricingTable({
  plans = defaultPlans,
  currentPlan,
  events,
  isLoading,
}: {
  plans?: readonly PlanName[];
  currentPlan?: PlanName;
  events?: Partial<Record<PlanName, () => void>>;
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
                  "text-foreground h-auto px-3 py-3 align-bottom",
                  key === "team" ? "bg-muted/30" : "bg-background",
                )}
              >
                <p className="font-cal sticky top-0 mb-2 text-2xl">
                  {plan.title}
                </p>
                <p className="text-muted-foreground mb-2 text-sm font-normal">
                  {plan.description}
                </p>
                <p className="mb-2 text-right">
                  <span className="font-cal text-xl">{plan.price}€</span>{" "}
                  <span className="text-muted-foreground text-sm font-light">
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
                    return router.push(`/app/sign-up?plan=${key}`);
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
          ([key, { label, features }], i) => {
            return (
              <Fragment key={i}>
                <TableRow className="bg-muted/50">
                  <TableCell
                    colSpan={selectedPlans.length + 1}
                    className="p-3 font-medium"
                  >
                    {label}
                  </TableCell>
                </TableRow>
                {features.map(({ label, value, badge }, i) => {
                  return (
                    <TableRow key={i}>
                      <TableCell className="gap-1">
                        {label}{" "}
                        {badge ? (
                          <Badge variant="secondary">{badge}</Badge>
                        ) : null}
                      </TableCell>
                      {selectedPlans.map((plan, i) => {
                        const limitValue = plan.limits[value];
                        function renderContent() {
                          if (typeof limitValue === "boolean") {
                            if (limitValue) {
                              return (
                                <Check className="text-foreground h-4 w-4" />
                              );
                            } else {
                              return (
                                <span className="text-muted-foreground/50">
                                  &#8208;
                                </span>
                              );
                            }
                          } else if (typeof limitValue === "number") {
                            return (
                              <span className="font-mono">{limitValue}</span>
                            );
                          } else if (
                            Array.isArray(limitValue) &&
                            limitValue.length > 0
                          ) {
                            return limitValue[0];
                          } else {
                            return limitValue;
                          }
                        }

                        return (
                          <TableCell
                            key={i}
                            className={cn(
                              "p-3",
                              plan.key === "team" && "bg-muted/30",
                            )}
                          >
                            {renderContent()}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </Fragment>
            );
          },
        )}
      </TableBody>
    </Table>
  );
}
