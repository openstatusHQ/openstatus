import { allUnrelateds } from "content-collections";

import { Separator } from "@openstatus/ui/src/components/separator";

import { Mdx } from "@/components/content/mdx";
import { Shell } from "@/components/dashboard/shell";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { Member } from "./_components/member";
import type { MemberProps } from "./_components/member";

const story = allUnrelateds.find((unrelated) => unrelated.slug === "our-story");

export default function AboutPage() {
  return (
    <MarketingLayout>
      <div className="my-8 grid w-full gap-8">
        <h1 className="font-cal text-4xl text-foreground">About OpenStatus</h1>
        <div className="grid max-w-2xl gap-2 text-lg text-muted-foreground">
          <p>
            OpenStatus is on a mission to provide a{" "}
            <span className="font-medium text-foreground">reliable</span>,{" "}
            <span className="font-medium text-foreground">easy</span> and{" "}
            <span className="font-medium text-foreground">fast</span> way to
            synthetically monitor your APIs and websites.
          </p>
          <p className="italic">Made by developers for developers.</p>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:gap-8">
          {members.map((member) => (
            <li key={member.name}>
              <Member {...member} />
            </li>
          ))}
          <li />
        </ul>
        <Separator className="my-2" />
        <Shell className="mx-auto w-auto shadow sm:px-8 sm:py-8 md:px-12 md:py-12 dark:border-card-foreground/30">
          {story ? (
            <Mdx
              code={story.mdx}
              className="sm:prose-lg mx-auto prose-li:my-0"
            />
          ) : null}
        </Shell>
      </div>
    </MarketingLayout>
  );
}

const members: MemberProps[] = [
  {
    name: "Maximilian Kaske",
    role: "Pilsner Advocate",
    image: { src: "/assets/authors/max.png" },
    socials: [
      {
        label: "Twitter",
        href: "https://twitter.com/mxkaske",
        icon: "twitter",
      },
    ],
  },
  {
    name: "Thibault Le Ouay Ducasse",
    role: "Gose Lover",
    image: { src: "/assets/authors/thibault.jpeg" },
    socials: [
      {
        label: "Bluesky",
        href: "https://bsky.app/profile/thibaultleouay.dev",
        icon: "bluesky",
      },
    ],
  },
];
