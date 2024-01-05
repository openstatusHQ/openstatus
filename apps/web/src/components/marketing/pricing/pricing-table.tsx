import { Fragment } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import type { PlanName } from "@openstatus/plans";
import {
  allPlans,
  plans as defaultPlans,
  pricingTableConfig,
} from "@openstatus/plans";
import {
  Button,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

import { cn } from "@/lib/utils";

export function PricingTable({
  plans = defaultPlans,
}: {
  plans?: readonly PlanName[];
}) {
  const selectedPlans = Object.entries(allPlans)
    .filter(([key, _]) => plans.includes(key as keyof typeof allPlans))
    .map(([key, value]) => ({ key, ...value }));
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
                  asChild
                >
                  <Link href={`/app/sign-up?plan=${key}`}>Choose</Link>
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
                {features.map(({ label, value }, i) => {
                  return (
                    <TableRow key={i}>
                      <TableCell>{label}</TableCell>
                      {selectedPlans.map((plan, i) => {
                        const limitValue = plan.limits[value];
                        function renderContent() {
                          if (typeof limitValue === "boolean") {
                            return (
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  limitValue
                                    ? "text-foreground"
                                    : "text-muted-foreground opacity-50",
                                )}
                              />
                            );
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
