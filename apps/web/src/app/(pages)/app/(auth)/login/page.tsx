import Link from "next/link";

import { Button, Separator } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";
import DevModeContainer from "@/components/dev-mode-container";
import { Icons } from "@/components/icons";
import { signIn } from "@/lib/auth";
import MagicLinkForm from "./_components/magic-link-form";
import { searchParamsCache } from "./search-params";

const isDev = process.env.NODE_ENV === "development";

export default async function Page(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const { redirectTo } = searchParamsCache.parse(searchParams);

  return (
    <Shell className="my-4 grid w-full max-w-xl gap-6 md:p-10">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-semibold text-3xl tracking-tight">Sign In</h1>
        <p className="text-muted-foreground text-sm">
          Get started now. No credit card required.
        </p>
      </div>
      <div className="grid gap-3">
        {isDev ? (
          <DevModeContainer className="grid gap-3">
            <MagicLinkForm />
            <Separator />
          </DevModeContainer>
        ) : null}
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo });
          }}
          className="w-full"
        >
          <Button type="submit" className="w-full">
            Sign in with GitHub <Icons.github className="ml-2 h-4 w-4" />
          </Button>
        </form>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
          className="w-full"
        >
          <Button type="submit" className="w-full" variant="outline">
            Sign in with Google <Icons.google className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>
      <p className="px-8 text-center text-muted-foreground text-sm">
        By clicking continue, you agree to our{" "}
        <Link
          href="/legal/terms"
          className="underline underline-offset-4 hover:text-primary hover:no-underline"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/legal/privacy"
          className="underline underline-offset-4 hover:text-primary hover:no-underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </Shell>
  );
}
