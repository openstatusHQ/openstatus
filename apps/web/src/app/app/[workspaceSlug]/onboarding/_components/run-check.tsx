"use client";

import { RequestTestButton } from "@/components/forms/monitor/request-test-button";
import { zodResolver } from "@hookform/resolvers/zod";
import type { InsertMonitor } from "@openstatus/db/src/schema";
import { insertMonitorSchema } from "@openstatus/db/src/schema";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { pingEndpoint } from "../utils";

interface RunCheckProps {
  url: string;
  limits: Limits;
  toStep: number;
}

export function RunCheck({ url, limits, toStep }: RunCheckProps) {
  const router = useRouter();

  const form = useForm<InsertMonitor>({
    resolver: zodResolver(insertMonitorSchema),
    defaultValues: { url },
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Select a region to test your endpoint:{" "}
        <span className="font-mono text-foreground">{url}</span>
      </p>
      <RequestTestButton
        form={form}
        limits={limits}
        pingEndpoint={(region) => pingEndpoint({ url, region })}
        onDismiss={() => {
          router.replace(`?step=${toStep}`);
          router.refresh();
        }}
      />
    </div>
  );
}
