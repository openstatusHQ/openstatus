import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { env } from "@/env";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "../shared-metadata";
import { externalStatusArray, getClassname } from "./utils";

export const revalidate = 600; // revalidate every 10 min

export const metadata: Metadata = {
  ...defaultMetadata,
  description: "Easily monitor if your external providers is working properly",
  title: "Is my external service down?",
  openGraph: {
    ...ogMetadata,
    title: "Is my external service down? | OpenStatus",
  },
  twitter: {
    ...twitterMetadata,
    title: "Is my external service down? | OpenStatus",
  },
};

const ExternalStatusPage = async () => {
  const res = await fetch(env.EXTERNAL_API_URL);
  const data = await res.json();
  const externalStatus = externalStatusArray.parse(data);
  return (
    <MarketingLayout>
      <h1 className="text-foreground font-cal mb-4 text-4xl">
        Is my external service down?
      </h1>
      <div className="text-muted-foreground mb-6">
        Easily check if your external providers is working properly
      </div>
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
        {externalStatus.map((status) => (
          <Link
            key={status.name}
            href={status.url}
            target="_blank"
            className="group flex w-full flex-1"
          >
            <Card className="flex w-full flex-col">
              <CardHeader className="flex-1">
                <CardTitle>{status.name}</CardTitle>
                <div className="flex flex-1 justify-between gap-3">
                  <CardDescription className={getClassname(status)}>
                    {status.status_description}
                  </CardDescription>
                  <ArrowUpRight className="text-muted-foreground group-hover:text-foreground h-5 w-5 shrink-0 self-end" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </MarketingLayout>
  );
};

export default ExternalStatusPage;
