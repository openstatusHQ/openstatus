import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { api } from "@/trpc/server";
import { ActionButton } from "./_components/action-button";
import { CreateForm } from "./_components/create-form";

export default async function Page({
  params,
}: {
  params: { workspaceId: string };
}) {
  const workspaceId = Number(params.workspaceId);
  const pages = await api.page.getPageByWorkspace.query({
    workspaceId,
  });
  // iterate over pages
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Status Page"
        description="Overview of all your status page."
      >
        <CreateForm {...{ workspaceId }} />
      </Header>
      {pages.map((page, index) => (
        <Container
          key={index}
          title={page.title}
          description={page.description}
        >
          <ActionButton {...page} />
          <dl className="[&_dt]:text-muted-foreground grid gap-2 [&>*]:text-sm [&_dt]:font-light">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <dt>Slug</dt>
              <dd className="font-mono">{page.slug}</dd>
            </div>
          </dl>
        </Container>
      ))}
    </div>
  );
}
