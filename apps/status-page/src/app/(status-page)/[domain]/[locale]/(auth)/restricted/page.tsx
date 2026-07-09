"use client";

import { Restricted } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import { useExtracted } from "next-intl";
import { notFound, useParams } from "next/navigation";

import { useTRPC } from "../../../../../../lib/trpc/client";

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
      <Restricted className="text-muted-foreground h-12 w-12" />
      <h1 className="text-2xl font-semibold">{t("Access Restricted")}</h1>
      <p className="text-muted-foreground">
        {t(
          "This status page is only accessible from specific IPv4 networks. Reach out to your network administrator to get access.",
        )}
      </p>
    </div>
  );
}
