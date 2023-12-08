"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Rocket, X } from "lucide-react";

import { Button } from "@openstatus/ui";

import { api } from "@/trpc/client";

export function ProBanner() {
  const [hidden, setHidden] = useState(true);
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug;

  function onClick() {
    if (document) {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      // store the cookie for 7 days and only for a specific workspace
      document.cookie = `hide-pro-banner=true; expires=${expires}; path=/app/${workspaceSlug}`;
    }
    setHidden(true);
  }

  useEffect(() => {
    async function configureProBanner() {
      const workspace = await api.workspace.getWorkspace.query();
      // make sure to display the banner only for free plans
      if (document && workspace?.plan === "free") {
        const cookie = document.cookie
          .split("; ")
          .find((row) => row.startsWith("hide-pro-banner"));
        if (!cookie) {
          setHidden(false);
        }
      }
    }
    configureProBanner();
  }, []);

  if (hidden) return null;

  return (
    <div className="border-border grid gap-2 rounded-md border p-2">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center text-sm font-medium">
          OpenStatus Pro <Rocket className="ml-2 h-4 w-4" />
        </p>
        <Button variant="ghost" size="icon" onClick={onClick}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Unlock custom domains, teams, 1 min. checks and more.
      </p>
      <Button variant="secondary" size="sm" asChild>
        <Link href={`/app/${workspaceSlug}/settings/billing`}>
          Upgrade <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
