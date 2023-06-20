"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { addToWaitlist } from "./action";
import { SubmitButton } from "./_components/submit-button";
import { toast } from "@/components/ui/use-toast";

export default function Page() {
  return (
    <main className="min-h-screen w-full flex flex-col p-4 md:p-8 space-y-6">
      <div className="flex-1 flex flex-col justify-center">
        <div className="mx-auto max-w-xl text-center">
          <div className="rounded-lg border border-border backdrop-blur-[2px] p-8 md:p-16">
            <Badge>Coming Soon</Badge>
            <h1 className="text-5xl text-foreground font-cal mb-6 mt-2">
              OpenStatus
            </h1>
            <p className="text-muted-foreground text-lg mb-4">
              {"Let's"} build a Saas together. Open for everyone. <br />
              Managed or self-hosted. Pay-as-you go or plans. <br />
              Choose your solution.
            </p>
            <form
              action={async (data) => {
                try {
                  const number = await addToWaitlist(data);
                  const formattedNumber = Intl.NumberFormat().format(number);
                  toast({
                    description: `Thank you, you're number ${formattedNumber} on the list.`,
                  });
                } catch (e) {
                  toast({
                    description: "Something went wrong",
                  });
                }
              }}
              className="flex gap-1.5"
            >
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="me@domain.com"
                required
              />
              <SubmitButton />
            </form>
          </div>
        </div>
      </div>
      <footer className="text-center text-sm text-muted-foreground mx-auto rounded-full px-4 py-2 border border-border backdrop-blur-[2px]">
        A collaboration between{" "}
        <a
          href="https://twitter.com/mxkaske"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:no-underline text-foreground"
        >
          @mxkaske
        </a>{" "}
        and{" "}
        <a
          href="https://twitter.com/thibaultleouay"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:no-underline text-foreground"
        >
          @thibaultleouay
        </a>
      </footer>
    </main>
  );
}
