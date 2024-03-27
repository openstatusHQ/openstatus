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
          <Card key={friend.name} className="group flex flex-col">
            <CardHeader className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>
                  <Link
                    href={friend.href}
                    target="_blank"
                    className="group-hover:underline"
                  >
                    {friend.name}
                  </Link>
                </CardTitle>
              </div>
              <CardDescription>{friend.description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <div className="flex items-center gap-2.5">
                <Link href={friend.href} target="_blank">
                  <Icons.globe className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </Link>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </MarketingLayout>
  );
};

export default OpenSourceFriends;
