import { Container } from "@/components/dashboard/container";
import { formatDate } from "@/lib/utils";
import { CreateForm } from "./create-form";
import { RevokeButton } from "./revoke-button";

export async function ApiKeys({
  ownerId,
  value,
}: {
  ownerId: number;
  value?: { id: string; start: string; createdAt: number };
}) {
  return (
    <>
      <Container
        title="API Token"
        description="Use our API endpoints to create your monitors programmatically."
        actions={
          <>
            {value ? (
              <RevokeButton keyId={value.id} />
            ) : (
              <CreateForm ownerId={ownerId} />
            )}
          </>
        }
      >
        {value ? (
          <dl className="grid gap-2 [&>*]:text-sm [&_dt]:font-light [&_dt]:text-muted-foreground">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <dt>Token</dt>
              <dd className="font-mono">{value.start}...</dd>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <dt>Created At</dt>
              <dd>
                {value.createdAt && formatDate(new Date(value.createdAt))}
              </dd>
            </div>
          </dl>
        ) : null}
      </Container>
      <p className="text-foreground text-sm">
        Read more about API in our{" "}
        <a
          className="text-foreground underline underline-offset-4 hover:no-underline"
          href="https://api.openstatus.dev/v1"
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
