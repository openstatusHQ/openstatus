import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { alternativesConfig as config } from "@/config/alternatives";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/src/components/card";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: "Compare Alternatives",
  description:
    "Compare alternatives to OpenStatus and start monitoring your website and api for free.",
  openGraph: {
    ...ogMetadata,
    title: "Compare Alternatives",
    description:
      "Compare alternatives to OpenStatus and start monitoring your website and api for free.",
  },
  twitter: {
    ...twitterMetadata,
    title: "Compare Alternatives",
    description:
      "Compare alternatives to OpenStatus and start monitoring your website and api for free.",
  },
};

export default function Page() {
  return (
    <>
      <div className="mb-5 space-y-3">
        <h1 className="font-cal text-4xl text-foreground">Alternatives</h1>
        <p className="text-lg text-muted-foreground">
          Compare OpenStatus with other Uptime and Synthetic Monitoring
          products.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {Object.entries(config).map(([slug, alternative]) => (
          <Link
            key={slug}
            href={`/compare/${slug}`}
            className="group flex w-full flex-1"
          >
            <Card className="flex w-full flex-col">
              <CardHeader className="flex-1">
                <CardTitle>{alternative.name} Alternative</CardTitle>
                <div className="flex flex-1 justify-between gap-3">
                  <CardDescription className="truncate mr-3">
                    {alternative.description}
                  </CardDescription>
                  <ChevronRight className="h-5 w-5 shrink-0 self-end text-muted-foreground group-hover:text-foreground" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
