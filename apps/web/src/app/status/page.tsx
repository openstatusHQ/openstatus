import type { Metadata } from "next";
import Link from "next/link";

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
          <Card key={status.name} className="group flex flex-col">
            <CardHeader className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>
                  <Link
                    href={status.url}
                    target="_blank"
                    className="group-hover:underline"
                  >
                    {status.name}
                  </Link>
                </CardTitle>
              </div>
              <CardDescription className={getClassname(status)}>
                {status.status_description}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <div className="flex items-center gap-2.5">
                <Link href={status.url} target="_blank">
                  <Icons.globe className="text-muted-foreground hover:text-foreground h-5 w-5" />
                </Link>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </MarketingLayout>
  );
};

export default ExternalStatusPage;
