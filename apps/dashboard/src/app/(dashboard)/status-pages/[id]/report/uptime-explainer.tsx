import { Button } from "@openstatus/ui/components/ui/button";
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
  UptimeCalculation,
  type UptimeMode,
  UptimeModeTiles,
} from "@/components/status-pages/uptime-calculation";

export function UptimeExplainer({
  pageId,
  mode,
}: {
  pageId: string;
  mode: UptimeMode;
}) {
  const current = UPTIME_MODES.find((m) => m.value === mode) ?? UPTIME_MODES[0];
  const configurationHref = `/status-pages/${pageId}/components#components-configuration`;

  return (
    <FormCard id="how-uptime-is-calculated">
      <FormCardHeader>
        <FormCardTitle>How uptime is calculated</FormCardTitle>
        <FormCardDescription>
          This page counts{" "}
          <span className="text-foreground font-medium">{current.label}</span>.
          It applies to every month here and to your public status page. Months
          without checks show no data, never downtime.{" "}
          <Link href={UPTIME_DOCS_URL}>Learn more</Link>
        </FormCardDescription>
      </FormCardHeader>
      <FormCardSeparator />
      <FormCardContent>
        <UptimeModeTiles mode={current.value} />
      </FormCardContent>
      <FormCardSeparator />
      <FormCardContent>
        <UptimeCalculation mode={current.value} />
      </FormCardContent>
      <FormCardFooter className="flex-wrap">
        <FormCardFooterInfo>
          Change it in{" "}
          <Link href={configurationHref}>
            Components &gt; Components Configuration
          </Link>
          . Months follow{" "}
          <Link href={`/status-pages/${pageId}/edit#timezone`}>
            Settings &gt; Timezone
          </Link>
          .
        </FormCardFooterInfo>
        <Button size="sm" asChild>
          <NextLink href={configurationHref}>Change calculation</NextLink>
        </Button>
      </FormCardFooter>
    </FormCard>
  );
}
