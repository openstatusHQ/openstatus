"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen w-full flex-col space-y-6 bg-background p-4 md:p-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="mx-auto max-w-xl border bg-card text-center">
          <div className="flex flex-col gap-4 p-6 sm:p-12">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-foreground">404 Page not found</p>
              <h2 className="font-cal text-2xl text-foreground">
                Oops, something went wrong.
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base">
                The page you are looking for doesn&apos;t exist.
              </p>
            </div>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                variant="outline"
                size="lg"
                onClick={router.back}
                className="cursor-pointer"
              >
                Go Back
              </Button>
              <Button size="lg" asChild>
                <Link href="/">Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
