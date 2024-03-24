import { allUnrelateds } from "contentlayer/generated";

import { Separator } from "@openstatus/ui";

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
        <h1 className="text-foreground font-cal text-4xl">About OpenStatus</h1>
        <div className="text-muted-foreground grid max-w-2xl gap-2 text-lg">
          <p>
            OpenStatus is on a mission to provide a{" "}
            <span className="text-foreground font-medium">reliable</span>,{" "}
            <span className="text-foreground font-medium">easy</span> and{" "}
            <span className="text-foreground font-medium">fast</span> way to
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
        <Shell className="dark:border-card-foreground/30 mx-auto w-auto shadow sm:px-8 sm:py-8 md:px-12 md:py-12">
          {story ? (
            <Mdx
              code={story.body.code}
              className="sm:prose-lg prose-li:my-0 mx-auto"
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
        label: "Twitter",
        href: "https://twitter.com/thibaultleouay",
        icon: "twitter",
      },
    ],
  },
];
