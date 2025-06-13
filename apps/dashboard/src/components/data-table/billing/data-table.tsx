"use client";

import { Check } from "lucide-react";

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

import { cn } from "@/lib/utils";
import { plans } from "@/data/plans";

export function DataTable() {
  return (
    <Table className="relative table-fixed">
      <TableCaption>
        A list to compare the different features by plan.
      </TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-background">
          <TableHead className="bg-background p-2 align-bottom">
            Features comparison
          </TableHead>
          {plans.map(({ id, ...plan }) => {
            return (
              <TableHead
                key={id}
                className={cn(
                  "h-px p-2 align-top text-foreground",
                  id === "starter" ? "bg-muted/30" : "bg-background"
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
                  >
                    Choose
                  </Button>
                </div>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="bg-muted/50">
          <TableCell colSpan={plans.length + 1} className="font-medium">
            All
          </TableCell>
        </TableRow>
        {Object.keys(plans[0].limits).map((key) => {
          return (
            <TableRow key={key}>
              <TableCell>
                <div className="flex items-center gap-2">{key}</div>
              </TableCell>
              {plans.map((plan) => {
                const limitValue = plan.limits[key as keyof typeof plan.limits];
                function renderContent() {
                  if (typeof limitValue === "boolean") {
                    if (limitValue) {
                      return <Check className="h-4 w-4 text-foreground" />;
                    }
                    return (
                      <span className="text-muted-foreground/50">&#8208;</span>
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
                    key={plan.id}
                    className={cn(
                      "font-mono",
                      plan.id === "starter" && "bg-muted/30"
                    )}
                  >
                    {renderContent()}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
