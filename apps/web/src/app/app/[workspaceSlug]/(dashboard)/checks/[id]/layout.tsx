import type { ReactNode } from "react";

import { Header } from "@/components/dashboard/header";
import AppPageLayout from "@/components/layout/app-page-layout";
import { api } from "@/trpc/server";
import { notFound } from "next/navigation";
import { RequestDetailsDialog } from "./request-details-dialog";

export default async function Layout({
  params,
  children,
}: {
  params: { id: string };
  children: ReactNode;
}) {
  const check = await api.check.getCheckById.query({
    id: Number.parseInt(params.id),
  });

  if (!check) return notFound();

  return (
    <AppPageLayout>
      <Header
        title={`Check #${check.id}`}
        description={<div className="font-mono">{check.url}</div>}
        actions={<RequestDetailsDialog check={check} />}
      />
      {children}
    </AppPageLayout>
  );
}
