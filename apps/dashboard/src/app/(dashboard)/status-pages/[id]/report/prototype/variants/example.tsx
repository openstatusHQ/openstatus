import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";
import NextLink from "next/link";

import { Link } from "@/components/common/link";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "@/components/forms/form-card";
import {
  UPTIME_DOCS_URL,
  UPTIME_MODES,
} from "@/data/uptime-calculation.client";

import { EXAMPLE, type VariantProps } from "../content";

export function Example({ mode, configurationHref }: VariantProps) {
  const label = UPTIME_MODES.find((m) => m.value === mode)?.label;
  const example = EXAMPLE[mode];
  return (
    <FormCard id="how-uptime-is-calculated">
      <FormCardHeader>
        <FormCardTitle>How uptime is calculated</FormCardTitle>
        <FormCardDescription>
          This page uses{" "}
          <span className="text-foreground font-medium">{label}</span>. Here is
          one month, worked out.
        </FormCardDescription>
      </FormCardHeader>
      <FormCardSeparator />
      <FormCardContent>
        <dl className="mx-auto grid max-w-xl gap-1.5 font-mono text-sm tabular-nums">
          <Row label={example.total.label} value={example.total.value} />
          {example.lines.map((line) => (
            <Row
              key={line.label}
              label={line.label}
              detail={line.detail}
              value={line.value}
              muted={line.muted}
            />
          ))}
          <div className="border-foreground/20 mt-1 flex items-baseline justify-between gap-4 border-t pt-2">
            <dt className="text-foreground font-medium">Uptime</dt>
            <dd className="text-foreground text-base font-medium">
              {example.result}
            </dd>
          </div>
        </dl>
      </FormCardContent>
      <FormCardFooter className="flex-wrap">
        <FormCardFooterInfo>
          Every month on this page and your public status page uses this.{" "}
          <Link href={UPTIME_DOCS_URL}>Learn more</Link>
        </FormCardFooterInfo>
        <Button size="sm" variant="outline" asChild>
          <NextLink href={configurationHref}>Change calculation</NextLink>
        </Button>
      </FormCardFooter>
    </FormCard>
  );
}

function Row({
  label,
  detail,
  value,
  muted,
}: {
  label: string;
  detail?: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4",
        muted ? "text-muted-foreground" : "text-foreground",
      )}
    >
      <dt className="min-w-0">
        {label}
        {detail ? (
          <span className="text-muted-foreground"> · {detail}</span>
        ) : null}
      </dt>
      <dd className="shrink-0 text-right">{value}</dd>
    </div>
  );
}
