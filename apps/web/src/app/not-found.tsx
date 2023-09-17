import Link from "next/link";

import { Button } from "@openstatus/ui/src/components/button";

import { Header } from "@/components/dashboard/header";
import { Shell } from "@/components/dashboard/shell";

export default function NotFound() {
  return (
    <main className="flex min-h-screen w-full flex-col space-y-6 p-4 md:p-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="mx-auto max-w-xl text-center">
          <Shell>
            <div className="flex flex-col gap-4 p-12">
              <Header
                title="404"
                description="Sorry, this page could not be found."
              />
              {/* could think of redirecting the user to somewhere else! */}
              <Button variant="link" asChild>
                <Link href="/">Homepage</Link>
              </Button>
            </div>
          </Shell>
        </div>
      </div>
    </main>
  );
}
