import type { ImageProps } from "next/image";
import Image from "next/image";
import Link from "next/link";

import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
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

import { PricingSlider } from "../marketing/pricing/pricing-slider";
import type { MetricsCardProps } from "../monitor-dashboard/metrics-card";
import { MetricsCard } from "../monitor-dashboard/metrics-card";
import { Callout, type CalloutProps } from "./callout";
import {
  ImageWithCaption,
  type ImageWithCaptionProps,
} from "./image-with-caption";
import Pre from "./pre";
import type { SimpleChartProps } from "./simple-chart";
import { SimpleChart } from "./simple-chart";

export const components = {
  a: ({ href = "", ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
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
  PricingSlider: () => {
    return <PricingSlider />;
  },
  SimpleChart: (props: SimpleChartProps) => {
    return (
      <div className="not-prose">
        <SimpleChart {...props} />
      </div>
    );
  },
  Callout: (props: CalloutProps) => {
    return (
      <div className="not-prose my-5">
        <Callout {...props} />
      </div>
    );
  },
  ImageWithCaption: (props: ImageWithCaptionProps) => (
    <ImageWithCaption {...props} />
  ),
  table: (props: HTMLAttributes<HTMLTableElement>) => <Table {...props} />,
  thead: (props: HTMLAttributes<HTMLTableSectionElement>) => (
    <TableHeader {...props} />
  ),
  tbody: (props: HTMLAttributes<HTMLTableSectionElement>) => (
    <TableBody {...props} />
  ),
  tfoot: (props: HTMLAttributes<HTMLTableSectionElement>) => (
    <TableFooter {...props} />
  ),
  tr: (props: HTMLAttributes<HTMLTableRowElement>) => <TableRow {...props} />,
  th: (props: ThHTMLAttributes<HTMLTableCellElement>) => (
    <TableHead {...props} />
  ),
  td: (props: TdHTMLAttributes<HTMLTableCellElement>) => (
    <TableCell {...props} />
  ),
  // FIXME: file duplication (not related to content-collections)
  pre: (props: HTMLAttributes<HTMLPreElement>) => <Pre {...props} />,
};
