import Link from "next/link";
import { z } from "zod";

import { Button, Separator } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";
import DevModeContainer from "@/components/dev-mode-container";
import { Icons } from "@/components/icons";
import { signIn } from "@/lib/auth";
import MagicLinkForm from "./_components/magic-link-form";

const isDev = process.env.NODE_ENV === "development";

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
        <h1 className="text-3xl font-semibold tracking-tight">Sign In</h1>
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
            Signin with GitHub <Icons.github className="ml-2 h-4 w-4" />
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
            Signin with Google <Icons.google className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>
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

// /**
//  * @deprecated on production - only to be used in development mode
//  */
// function MagicLinkForm() {
//   return (
//     <form
//       action={async (formData) => {
//         "use server";
//         try {
//           await signIn("resend", formData);
//         } catch (e) {
//           // console.error(e);
//         } finally {
//           redirect("/app");
//         }
//       }}
//       className="grid gap-2"
//     >
//       <div className="grid gap-1.5">
//         <Label htmlFor="email">Email</Label>
//         <Input id="email" name="email" type="email" />
//       </div>
//       <Button variant="secondary" className="w-full">
//         Sign In
//       </Button>
//     </form>
//   );
// }
