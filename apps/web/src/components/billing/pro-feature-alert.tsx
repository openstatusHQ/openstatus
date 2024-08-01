"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import type { WorkspacePlan } from "@openstatus/db/src/schema/workspaces/validation";
import { Alert, AlertDescription, AlertTitle } from "@openstatus/ui";

interface Props {
  feature: string;
  workspacePlan?: WorkspacePlan;
}

export function ProFeatureAlert({ feature, workspacePlan = "pro" }: Props) {
  const params = useParams<{ workspaceSlug: string }>();
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {feature} is a <span className="capitalize">{workspacePlan}</span>{" "}
        feature.
      </AlertTitle>
      <AlertDescription>
        If you want to use{" "}
        <span className="lowercase underline decoration-dotted">{feature}</span>
        , please upgrade your plan. Go to{" "}
        <Link
          href={`/app/${params.workspaceSlug}/settings/billing`}
          className="inline-flex items-center font-medium text-foreground underline underline-offset-4 hover:no-underline"
        >
          settings
        </Link>
        .
      </AlertDescription>
    </Alert>
  );
}
