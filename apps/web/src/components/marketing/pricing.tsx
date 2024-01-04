import { Fragment } from "react";
import { Check } from "lucide-react";

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

import { plansConfig, pricingTableConfig } from "@/config/pricing";
import { cn } from "@/lib/utils";

export function Pricing() {
  return (
    // overflow={false}
    <Table className="relative">
      <TableCaption>
        A list to compare the different features by plan.
      </TableCaption>
      <TableHeader>
        {/* TODO: use [&_th]: */}
        <TableRow className="hover:bg-background">
          {/* sticky top-0 */}
          <TableHead className="sticky top-0 px-3 py-3 align-bottom">
            Features comparison
          </TableHead>
          {Object.entries(plansConfig).map(([key, plan]) => {
            return (
              <TableHead
                key={key}
                className={cn(
                  // sticky top
                  "text-foreground h-auto px-3 py-3 align-bottom",
                  key === "team" ? "bg-muted/30" : "bg-background",
                )}
              >
                <p className="font-cal mb-1 text-lg">{plan.title}</p>
                <p className="text-muted-foreground mb-2 text-xs font-normal">
                  {plan.description}
                </p>
                <p className="mb-2 text-right">
                  <span className="font-cal text-lg">{plan.price}€</span>{" "}
                  <span className="text-muted-foreground text-sm font-light">
                    /month
                  </span>
                </p>
                <Button
                  className="w-full"
                  size="sm"
                  variant={key === "team" ? "default" : "outline"}
                >
                  Choose
                </Button>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(pricingTableConfig).map(
          ([key, { title, features }]) => {
            return (
              <Fragment key={key}>
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={5} className="p-3 font-medium">
                    {title}
                  </TableCell>
                </TableRow>
                {features.map((feature, i) => {
                  const { title, values } = feature;
                  return (
                    <TableRow key={i}>
                      <TableCell>{title}</TableCell>
                      {Object.entries(values).map(([key, value]) => {
                        if (typeof value === "boolean") {
                          return (
                            <TableCell
                              key={key}
                              className={cn(
                                "p-3",
                                key === "team" && "bg-muted/30",
                              )}
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  value
                                    ? "text-foreground"
                                    : "text-muted-foreground opacity-50",
                                )}
                              />
                            </TableCell>
                          );
                        }

                        if (typeof value === "number") {
                          return (
                            <TableCell
                              key={key}
                              className={cn(
                                "p-3 font-mono",
                                key === "team" && "bg-muted/30",
                              )}
                            >
                              {value}
                            </TableCell>
                          );
                        }

                        return (
                          <TableCell
                            key={key}
                            className={cn(
                              "p-3",
                              key === "team" && "bg-muted/30",
                            )}
                          >
                            {value}
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
