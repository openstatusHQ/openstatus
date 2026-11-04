import {
  StatusPageMain,
  StatusPageShell,
} from "@openstatus/ui/components/blocks/status-page-shell";
import { Suspense } from "react";

import { EmbedShell } from "../../../../../components/layout/embed-shell";
import { Footer } from "../../../../../components/nav/footer";
import { Header } from "../../../../../components/nav/header";
import { getQueryClient, trpc } from "../../../../../lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const queryClient = getQueryClient();
  const { domain } = await params;
  const page = await queryClient.fetchQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  return (
    <Suspense>
      <EmbedShell>
        <StatusPageShell
          data-width={page?.configuration?.width ?? "default"}
          className="group-data-[embed=true]/embed:min-h-0"
        >
          <Header className="w-full border-b" />
          {/* `!` so embed mode stays full width in a wide shell */}
          <StatusPageMain className="group-data-[embed=true]/embed:mx-0 group-data-[embed=true]/embed:max-w-none!">
            {children}
          </StatusPageMain>
          <Footer className="w-full border-t" />
        </StatusPageShell>
      </EmbedShell>
    </Suspense>
  );
}
