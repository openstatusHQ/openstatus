import Link from "next/link";
import { z } from "zod";

import { Button } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";
import { signIn } from "@/lib/auth";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  redirectTo: z.string().optional().default("/app"),
});

export default function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);
  const redirectTo = search.success ? search.data.redirectTo : "/app";

  return (
    <Shell className="my-4 grid w-full max-w-xl gap-6 md:p-10">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Log In</h1>
        <p className="text-muted-foreground text-sm">
          Get started now. No credit card required.
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo });
        }}
        className="w-full"
      >
        <Button type="submit" className="w-full">
          Signin with GitHub
        </Button>
      </form>
      <p className="text-muted-foreground px-8 text-center text-sm">
        By clicking continue, you agree to our{" "}
        <Link
          href="/legal/terms"
          className="hover:text-primary underline underline-offset-4 hover:no-underline"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/legal/privacy"
          className="hover:text-primary underline underline-offset-4 hover:no-underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </Shell>
  );
}
