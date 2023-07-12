import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { StatusPageCreateForm } from "@/components/forms/status-page-form";
import { api } from "@/trpc/server";

export default async function Page({
  params,
}: {
  params: { workspaceId: string };
}) {
  const pages = await api.page.getPageByWorkspace.query({
    workspaceId: Number(params.workspaceId),
  });
  // iterate over pages
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Status Page"
        description="Overview of all your status page."
      >
        <StatusPageCreateForm />
      </Header>
      {pages.map((page, index) => (
        <Container key={index} title={page.title}></Container>
      ))}
    </div>
  );
}
