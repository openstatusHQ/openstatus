import Link from "next/link";
import { z } from "zod";

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

const ExternalStatus = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
  external_id: z.string(),
  last_updated_at: z.string().datetime({ offset: true }),
  time_zone: z.string(),
  status_indicator: z.string(),
  status_description: z.string(),
  created_at: z.string(),
  updated_at: z.string().datetime(),
});

const ExternalStatusPage = async () => {
  console.log(env.EXTERNAL_API_URL);
  const res = await fetch(env.EXTERNAL_API_URL);
  const data = await res.json();
  const openSourceFriends = z.array(ExternalStatus).parse(data);

  return (
    <MarketingLayout>
      <h1 className="text-foreground font-cal mb-4 text-4xl">
        Is my external service down?
      </h1>
      <div className="text-muted-foreground mb-6">
        Easily check if your external providers is working properly
      </div>
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
        {openSourceFriends.map((status) => (
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
              <CardDescription>{status.status_description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <div className="flex items-center gap-2.5">
                <Link href={status.url} target="_blank">
                  <Icons.globe className="text-muted-foreground h-5 w-5 hover:text-black" />
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
