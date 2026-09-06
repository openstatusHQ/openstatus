import type { RouterOutputs } from "@openstatus/api";
import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";

import { getQueryClient, trpc } from "@/lib/trpc/server";

import { ConsentForm } from "./consent-form";
import { searchParamsCache } from "./search-params";

export const metadata: Metadata = {
  title: "Authorize",
  robots: { index: false, follow: false },
};

function Unavailable() {
  return (
    <div className="my-16 grid w-full max-w-lg gap-6 text-center">
      <h1 className="font-cal text-3xl tracking-tight">Start again</h1>
      <p className="font-commit-mono text-muted-foreground text-sm text-pretty">
        This authorization request has expired or was already answered. Go back
        to your client and connect again.
      </p>
    </div>
  );
}

export default async function Page(props: {
  searchParams: Promise<SearchParams>;
}) {
  const { session } = searchParamsCache.parse(await props.searchParams);
  if (!session) return <Unavailable />;

  // Blocking fetch: an expired or decided session renders server-side.
  let data: RouterOutputs["oauth"]["getSession"];
  try {
    data = await getQueryClient().fetchQuery(
      trpc.oauth.getSession.queryOptions({ id: session }),
    );
  } catch {
    return <Unavailable />;
  }

  return (
    <ConsentForm
      sessionId={session}
      clientName={data.session.clientName}
      clientOrigin={data.session.clientOrigin}
      requestedScope={data.session.scope}
      workspaces={data.workspaces}
    />
  );
}
