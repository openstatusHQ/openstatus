import { notFound } from "next/navigation";
import type * as React from "react";

import { Separator } from "@openstatus/ui";

import { api } from "@/trpc/server";
import { Header } from "./_components/header";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string; reportId: string };
}) {
  const report = await api.statusReport.getStatusReportById.query({
    id: Number.parseInt(params.reportId),
  });

  if (!report) return notFound();

  return (
    <>
      <Header report={report} />
      {children}
    </>
  );
}
