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
    <>
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
          <dl className="grid gap-2 [&_dt]:font-light [&>*]:text-sm [&_dt]:text-muted-foreground">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <dt>Token</dt>
              <dd className="font-mono">{key.start}...</dd>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <dt>Created At</dt>
              <dd>{key.createdAt && formatDate(new Date(key.createdAt))}</dd>
            </div>
          </dl>
        ) : null}
      </Container>
      <p className="text-foreground text-sm">
        Read more about APIs in our{" "}
        <a
          className="text-foreground underline underline-offset-4 hover:no-underline"
          href="https://docs.openstatus.dev/api-reference/auth"
          target="_blank"
          rel="noreferrer"
        >
          docs
        </a>
        .
      </p>
    </>
  );
}
