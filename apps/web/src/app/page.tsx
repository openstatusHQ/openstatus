import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { waitlist } from "./action";
import { SubmitButton } from "./components/submit-button";

export default function Page() {
  return (
    <main className="min-h-screen w-full flex flex-col p-4 md:p-8 space-y-6">
      <div className="flex-1 flex flex-col justify-center">
        <div className="mx-auto max-w-xl text-center">
          <div className="rounded-lg border border-border backdrop-blur-[2px] p-8">
            <Badge>Announcing Post</Badge>
            <h1 className="text-3xl text-foreground font-cal mb-6 mt-2">
              OpenStatus
            </h1>
            <p className="text-muted-foreground mb-4">
              Your Open Source Status Page.
            </p>
            <form action={waitlist} className="flex gap-1.5">
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
        Creating by{" "}
        <a
          href="https://twitter.com/mxkaske"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:no-underline"
        >
          @mxkaske
        </a>{" "}
        and{" "}
        <a
          href="https://twitter.com/thibaultleouay"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:no-underline"
        >
          @thibaultleouay
        </a>
      </footer>
    </main>
  );
}
