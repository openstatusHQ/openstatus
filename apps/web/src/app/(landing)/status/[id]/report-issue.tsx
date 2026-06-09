"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { useState } from "react";

import { api } from "@/trpc/rq-client";

const WHOLE_SERVICE = "all";

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="not-prose bg-muted/20 flex flex-col gap-3 border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      {children}
    </div>
  );
}

export function ReportIssue({
  slug,
  name,
  days,
  componentSlug,
  allowComponentSelect,
}: {
  slug: string;
  name: string;
  days?: number;
  componentSlug?: string;
  allowComponentSelect?: boolean;
}) {
  const utils = api.useUtils();
  const [selected, setSelected] = useState<string>(WHOLE_SERVICE);
  const mutation = api.externalService.report.useMutation({
    onSuccess: () => {
      utils.externalService.reports.invalidate({ slug });
      utils.externalService.detail.invalidate({ slug });
      utils.externalService.component.invalidate({ serviceSlug: slug });
      utils.externalService.grid.invalidate();
    },
  });

  const components = api.externalService.components.useQuery(
    { slug, days },
    { enabled: Boolean(allowComponentSelect) },
  );
  const componentOptions =
    allowComponentSelect && components.data?.supported
      ? components.data.components
      : [];

  if (mutation.isSuccess) {
    return (
      <Box>
        <p className="text-muted-foreground m-0! text-sm" role="status">
          {mutation.data.alreadyReported
            ? "You've already reported this recently. Thanks!"
            : `Thanks! Your report for ${name} was recorded.`}
        </p>
      </Box>
    );
  }

  const onClick = () => {
    const component =
      componentSlug ?? (selected === WHOLE_SERVICE ? undefined : selected);
    mutation.mutate({ slug, componentSlug: component });
  };

  return (
    <Box>
      <div className="text-sm">
        <p className="m-0! font-medium">Seeing problems with {name}?</p>
        <p className="text-muted-foreground m-0!">
          Report it so other users know. We'll flag it when enough people do.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
        {componentOptions.length > 0 ? (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-[200px] rounded-none">
              <SelectValue placeholder="Which area? (optional)" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value={WHOLE_SERVICE} className="rounded-none">
                Whole service
              </SelectItem>
              {componentOptions.map((c) => (
                <SelectItem
                  key={c.slug}
                  value={c.slug}
                  className="rounded-none"
                >
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button
          variant="default"
          className="rounded-none"
          disabled={mutation.isPending}
          onClick={onClick}
        >
          {mutation.isPending ? "Reporting…" : "Report a problem"}
        </Button>
      </div>
    </Box>
  );
}
