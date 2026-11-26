"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { Label } from "@openstatus/ui/components/ui/label";
import { Switch } from "@openstatus/ui/components/ui/switch";
import NextLink from "next/link";

import { Link } from "@/components/common/link";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import {
  formatMonitorVisibility,
  useMonitorVisibility,
} from "@/hooks/use-monitor-visibility";

// Read-only: visibility moved to the page component, so the same monitor can
// be public on one status page and private on another.
export function FormVisibility({ monitorId }: { monitorId: number }) {
  const visibility = useMonitorVisibility(monitorId);
  return (
    <FormCard id="visibility">
      <FormCardHeader>
        <FormCardTitle>Visibility</FormCardTitle>
        <FormCardDescription>
          Visibility is now set per status page component.
        </FormCardDescription>
      </FormCardHeader>
      <FormCardContent>
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="monitor-visibility" className="opacity-50">
              Allow public access
            </Label>
            <p className="text-muted-foreground text-sm">
              A monitor can be attached to several status pages, so you now
              choose on each page whether its stats are public. Use the
              visibility toggle next to the component under{" "}
              <NextLink href="/status-pages" className="text-foreground">
                Status Pages &gt; Components
              </NextLink>
              .
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {formatMonitorVisibility(visibility)}
            </span>
            <Switch
              id="monitor-visibility"
              checked={(visibility?.publicPages ?? 0) > 0}
              disabled
            />
          </div>
        </div>
      </FormCardContent>
      <FormCardFooter>
        <FormCardFooterInfo>
          Read the{" "}
          <Link
            href="https://www.openstatus.dev/changelog/page-component-visibility"
            rel="noreferrer"
            target="_blank"
          >
            changelog
          </Link>{" "}
          or the{" "}
          <Link
            href="https://www.openstatus.dev/docs/reference/page-components#visibility"
            rel="noreferrer"
            target="_blank"
          >
            page components docs
          </Link>
          .
        </FormCardFooterInfo>
        <Button variant="outline" asChild>
          <NextLink href="/status-pages">Go to status pages</NextLink>
        </Button>
      </FormCardFooter>
    </FormCard>
  );
}
