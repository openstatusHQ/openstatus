"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useExtracted } from "next-intl";
import { notFound, useParams } from "next/navigation";

export default function RestrictedPage() {
  const { domain } = useParams<{ domain: string }>();
  const t = useExtracted();
  const trpc = useTRPC();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  if (page && page.accessType !== "ip-restriction") {
    return notFound();
  }

  return (
    <div className="m-auto flex flex-col items-center justify-center gap-4 p-4 text-center">
      <ShieldAlert className="h-12 w-12 text-muted-foreground" />
      <h1 className="font-semibold text-2xl">{t("Access Restricted")}</h1>
      <p className="text-muted-foreground">
        {t(
          "This status page is restricted and cannot be accessed from your network. Reach out to your network administrator to get access.",
        )}
      </p>
    </div>
  );
}
