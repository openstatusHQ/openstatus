"use server";

import { Unkey } from "@unkey/api";

import { Container } from "@/components/dashboard/container";
import { env } from "@/env";
import { formatDate } from "@/lib/utils";
import { CreateForm } from "./create-form";
import { RevokeButton } from "./revoke-button";

const unkey = new Unkey({ token: env.UNKEY_TOKEN });

export async function ApiKeys({ ownerId }: { ownerId: number }) {
  const data = await unkey.apis.listKeys({
    apiId: env.UNKEY_API_ID,
    ownerId: String(ownerId),
  });

  if (data.error) {
    return <div>Something went wrong. Please contact us.</div>;
  }

  const key = data.result.keys?.[0] || undefined;

  return (
    <Container
      title="API Token"
      description="Use our API endpoints to create your monitors programmatically."
      actions={
        <>
          {key ? (
            <RevokeButton keyId={key.id} />
          ) : (
            <CreateForm ownerId={ownerId} />
          )}
        </>
      }
    >
      {key ? (
        <dl className="[&_dt]:text-muted-foreground grid gap-2 [&>*]:text-sm [&_dt]:font-light">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <dt>Token</dt>
            <dd className="font-mono">{key.start}...</dd>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <dt>Created At</dt>
            <dd>{formatDate(new Date(key.createdAt!))}</dd>
          </div>
        </dl>
      ) : null}
    </Container>
  );
}
