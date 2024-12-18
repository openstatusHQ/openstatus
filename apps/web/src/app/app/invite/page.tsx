import { Alert, AlertDescription, AlertTitle, Separator } from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { api } from "@/trpc/server";
import { LinkCards } from "./_components/link-cards";
import { searchParamsCache } from "./search-params";

const AlertTriangle = Icons["alert-triangle"];

export default async function InvitePage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const { token } = searchParamsCache.parse(searchParams);
  const { message, data } = token
    ? await api.invitation.acceptInvitation.mutate({ token })
    : { message: "Unavailable invitation token.", data: undefined };

  const workspace = await api.workspace.getWorkspace.query();

  if (!data) {
    return (
      <div className="mx-auto flex h-full max-w-xl flex-1 flex-col items-center justify-center gap-4">
        <h1 className="font-semibold text-2xl">Invitation</h1>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        <Separator className="my-4" />
        <p className="text-muted-foreground">Quick Links</p>
        <LinkCards slug={workspace.slug} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-xl flex-1 flex-col items-center justify-center gap-4">
      <h1 className="font-semibold text-2xl">Invitation</h1>
      <Alert>
        <Icons.check className="h-4 w-4" />
        <AlertTitle>Ready to go</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Separator className="my-4" />
      <p className="text-muted-foreground">Quick Links</p>
      <LinkCards slug={data.slug} />
    </div>
  );
}
