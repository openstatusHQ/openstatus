"use client";

import { alternativesConfig as config } from "@/config/alternatives";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/src/components/table";
import { ArrowUpRight, CircleCheck, CircleHelp, Minus } from "lucide-react";
import type React from "react";

export function ComparisonTable({ slug }: { slug: string }) {
  const alternative = config[slug as keyof typeof config];
  return (
    <Table className="relative">
      <TableCaption>
        Plan comparison between OpenStatus and {alternative.name}.
      </TableCaption>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead className="px-3 py-3 align-bottom">Feature</TableHead>
          <TableHead className="h-auto px-3 py-3 text-center align-middle text-foreground">
            OpenStatus
          </TableHead>
          <TableHead className="h-auto px-3 py-3 text-center align-middle text-foreground">
            {alternative.name}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {alternative.features.map(
          ({ label, description, openstatus, alternative, url }, _i) => {
            return (
              <TableRow key={label} className="group/row">
                <TableCell className="p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{label}</span>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group hidden items-center gap-1 font-normal text-muted-foreground text-sm sm:flex"
                      >
                        {description}
                        {/* FIXME: arrow is not `text-foreground` when hovered */}
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-transparent group-hover/row:text-muted-foreground group-hover:text-foreground" />
                      </a>
                    ) : (
                      <span className="hidden font-normal text-muted-foreground text-sm sm:block">
                        {description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Cell value={openstatus} />
                </TableCell>
                <TableCell className="text-center">
                  <Cell value={alternative} />
                </TableCell>
              </TableRow>
            );
          },
        )}
      </TableBody>
    </Table>
  );
}

function Cell({
  value,
}: {
  value: boolean | string | number | React.ReactNode;
}) {
  if (typeof value === "boolean") {
    return value ? (
      <CircleCheck className="mx-auto size-5 text-green-500" />
    ) : (
      <Minus className="mx-auto size-5 text-muted-foreground" />
    );
  }

  if (
    typeof value === "number" ||
    (typeof value === "string" && value === "Unlimited")
  ) {
    return <span className="font-medium font-mono">{value}</span>;
  }

  if (typeof value === "string") {
    return <span className="font-medium">{value}</span>;
  }

  if (typeof value === "undefined") {
    // TODO check for rounded question
    return <CircleHelp className="mx-auto size-5 text-muted-foreground" />;
  }

  return value;
}
