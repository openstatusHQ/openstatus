"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@openstatus/ui";

interface Props {
  feature: string;
}

export function ProFeatureAlert({ feature }: Props) {
  const params = useParams<{ workspaceSlug: string }>();
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{feature} is a Pro feature.</AlertTitle>
      <AlertDescription>
        If you want to use{" "}
        <span className="underline decoration-dotted">{feature}</span>, please
        upgrade your plan. Go to{" "}
        <Link
          href={`/app/${params.workspaceSlug}/settings/billing`}
          className="text-foreground inline-flex items-center font-medium underline underline-offset-4 hover:no-underline"
        >
          settings
        </Link>
        .
      </AlertDescription>
    </Alert>
  );
}
