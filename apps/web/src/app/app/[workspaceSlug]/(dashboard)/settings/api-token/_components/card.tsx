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

  return (
    <Container
      title="API Token"
      description="Use our API endpoints to create your monitors programmatically."
      actions={
        <>
          {data.result.keys.length === 1 ? (
            <RevokeButton keyId={data.result.keys[0].id} />
          ) : (
            <CreateForm ownerId={ownerId} />
          )}
        </>
      }
    >
      {data.result.keys.length === 1 ? (
        <dl className="[&_dt]:text-muted-foreground grid gap-2 [&>*]:text-sm [&_dt]:font-light">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <dt>Token</dt>
            <dd className="font-mono">{data.result.keys[0].start}...</dd>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <dt>Created At</dt>
            <dd>{formatDate(new Date(data.result.keys[0].createdAt))}</dd>
          </div>
        </dl>
      ) : null}
    </Container>
  );
}
