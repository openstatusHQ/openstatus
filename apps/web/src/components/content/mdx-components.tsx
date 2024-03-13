import * as React from "react";
import type { ImageProps } from "next/image";
import Image from "next/image";
import Link from "next/link";
import type { TweetProps } from "react-tweet";
import { Tweet } from "react-tweet";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

import { MetricsCard } from "@/app/app/[workspaceSlug]/(dashboard)/monitors/[id]/_components/metrics-card";
import type { MetricsCardProps } from "@/app/app/[workspaceSlug]/(dashboard)/monitors/[id]/_components/metrics-card";
import type { SimpleChartProps } from "./simple-chart";
import { SimpleChart } from "./simple-chart";

export const components = {
  a: ({
    href = "",
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    if (href.startsWith("http")) {
      return (
        <a
          className="text-foreground underline underline-offset-4 hover:no-underline"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        />
      );
    }

    return (
      <Link
        href={href}
        className="text-foreground underline underline-offset-4 hover:no-underline"
        {...props}
      />
    );
  },
  Tweet: (props: TweetProps) => {
    return (
      <div data-theme="light" className="not-prose [&>div]:mx-auto">
        <Tweet {...props} />
      </div>
    );
  },
  Image: (props: ImageProps) => <Image {...props} />,
  MetricsCard: (props: MetricsCardProps) => {
    return (
      // remove prose class from cards
      <div className="not-prose">
        <MetricsCard {...props} />
      </div>
    );
  },
  SimpleChart: (props: SimpleChartProps) => {
    return (
      <div className="not-prose">
        <SimpleChart {...props} />
      </div>
    );
  },
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <Table {...props} />
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <TableHeader {...props} />
  ),
  tbody: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <TableBody {...props} />
  ),
  tfoot: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <TableFooter {...props} />
  ),
  tr: (props: React.HTMLAttributes<HTMLTableRowElement>) => (
    <TableRow {...props} />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <TableHead {...props} />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <TableCell {...props} />
  ),
};
