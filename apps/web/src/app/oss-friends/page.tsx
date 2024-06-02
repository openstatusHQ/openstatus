import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { Card, CardDescription, CardHeader, CardTitle } from "@openstatus/ui";

import { MarketingLayout } from "@/components/layout/marketing-layout";

const OSSFriendSchema = z.object({
  href: z.string(),
  name: z.string(),
  description: z.string(),
});

const OpenSourceFriends = async () => {
  const res = await fetch("https://formbricks.com/api/oss-friends");
  const data = await res.json();
  const openSourceFriends = z.array(OSSFriendSchema).parse(data.data);
  return (
    <MarketingLayout>
      <h1 className="mb-5 font-cal text-4xl text-foreground">
        Our OpenSource Friends
      </h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {openSourceFriends.map((friend) => (
          <Link
            key={friend.name}
            href={friend.href}
            target="_blank"
            className="group flex w-full flex-1"
          >
            <Card className="flex w-full flex-col">
              <CardHeader className="flex-1">
                <CardTitle>{friend.name}</CardTitle>
                <div className="flex flex-1 justify-between gap-3">
                  <CardDescription>{friend.description}</CardDescription>
                  <ArrowUpRight className="h-5 w-5 shrink-0 self-end text-muted-foreground group-hover:text-foreground" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </MarketingLayout>
  );
};

export default OpenSourceFriends;
