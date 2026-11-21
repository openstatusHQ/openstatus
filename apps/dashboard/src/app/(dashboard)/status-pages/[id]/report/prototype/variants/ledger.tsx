import { Check, Close } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import NextLink from "next/link";
import type React from "react";

import { Link } from "@/components/common/link";
import {
  FormCard,
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

import { LEDGER, type Rule, type VariantProps } from "../content";

export function Ledger({
  mode,
  configurationHref,
  timezoneHref,
}: VariantProps) {
  const label = UPTIME_MODES.find((m) => m.value === mode)?.label;
  const { down, up } = LEDGER[mode];
  return (
    <FormCard id="how-uptime-is-calculated">
      <FormCardHeader className="flex flex-row items-center justify-between gap-2">
        <FormCardTitle>What counts against uptime</FormCardTitle>
        <span className="text-muted-foreground font-mono text-xs">{label}</span>
      </FormCardHeader>
      <FormCardSeparator />
      <div className="grid sm:grid-cols-2 sm:divide-x">
        <Column
          title="Downtime"
          icon={<Close className="text-destructive size-3.5" />}
          rules={down}
        />
        <Column
          title="Not downtime"
          icon={<Check className="text-success size-3.5" />}
          rules={up}
          className="border-t sm:border-t-0"
        />
      </div>
      <FormCardFooter className="flex-wrap">
        <FormCardFooterInfo>
          Months follow the <Link href={timezoneHref}>page timezone</Link>.{" "}
          <Link href={UPTIME_DOCS_URL}>Learn more</Link>
        </FormCardFooterInfo>
        <Button size="sm" variant="outline" asChild>
          <NextLink href={configurationHref}>Change calculation</NextLink>
        </Button>
      </FormCardFooter>
    </FormCard>
  );
}

function Column({
  title,
  icon,
  rules,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  rules: Rule[];
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-sm font-medium">
        {icon}
        {title}
      </div>
      <ul className="grid px-4 pb-3 text-sm">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className="flex items-baseline justify-between gap-4 border-b border-dashed py-2 last:border-b-0"
          >
            <span>
              {rule.label}
              {rule.note ? (
                <span className="text-muted-foreground"> · {rule.note}</span>
              ) : null}
            </span>
            {rule.weight ? (
              <span className="text-muted-foreground font-mono tabular-nums">
                {rule.weight}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
