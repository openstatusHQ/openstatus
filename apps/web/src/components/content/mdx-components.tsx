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

// Table parser (string -> table)
function parseMarkdownTable(mdTableString: string) {

  const lines = mdTableString.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return null;

  const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
  const rows = lines.slice(2).map(line =>
    line.split('|').map(cell => cell.trim()).filter(Boolean)
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>{headers.map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

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
  p: ({ children }: { children?: React.ReactNode }) => {
    if (typeof children === 'string' && children.includes('|')) {
      //parse as markdown table
      const table = parseMarkdownTable(children);
      if (table) return table;
    }
    return <p>{children}</p>;
  },
  // FIXME: file duplication (not related to content-collections)
  pre: (props: HTMLAttributes<HTMLPreElement>) => <Pre {...props} />,
};
