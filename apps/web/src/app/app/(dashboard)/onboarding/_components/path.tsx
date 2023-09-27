"use client";

import { useRouter } from "next/navigation";

import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";

export function Path() {
  return (
    <div className="grid gap-6 md:grid-cols-4">
      <HttpCard />
      <VercelCard />
    </div>
  );
}

function HttpCard() {
  const updateSearchParams = useUpdateSearchParams();
  const router = useRouter();
  return (
    <Card className="relative flex flex-col justify-between md:col-span-2">
      <Badge
        variant="secondary"
        className="bg-background text-muted-foreground absolute -top-3 right-2"
      >
        Standard
      </Badge>
      <CardHeader>
        <CardTitle>HTTP Endpoint</CardTitle>
        <CardDescription>
          Monitor your API or website via POST or GET requests including custom
          headers and body payload.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          size="lg"
          onClick={() => {
            router.push(`?${updateSearchParams({ path: "http" })}`);
          }}
        >
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}

function VercelCard() {
  async function trackEvent() {
    await fetch("/api/analytics");
  }

  return (
    <Card className="relative flex flex-col justify-between md:col-span-2">
      <Badge
        variant="secondary"
        className="bg-background text-muted-foreground absolute -top-3 right-2"
      >
        Beta
      </Badge>
      <CardHeader>
        <CardTitle>Vercel Integration</CardTitle>
        <CardDescription>
          Monitor your Vercel applications with ease.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" onClick={trackEvent}>
              Continue
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Vercel Integration <Badge>Beta</Badge>
              </DialogTitle>
              <DialogDescription>
                The integration is currently in closed beta.
              </DialogDescription>
            </DialogHeader>
            <div>
              <p className="">
                Please contact us:{" "}
                <Button variant="link" className="font-mono" asChild>
                  <a href="mailto:thibault@openstatus.dev">
                    thibault@openstatus.dev
                  </a>
                </Button>
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}
