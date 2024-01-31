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
      <div className="my-8 grid w-full gap-12">
        <div className="grid w-full gap-8">
          <h1 className="text-foreground font-cal text-4xl">
            About OpenStatus
          </h1>
          <p className="text-muted-foreground max-w-3xl text-lg leading-relaxed">
            We are a small team of developers who are passionate about open
            source and the latest tech. We are building OpenStatus to help
            developers & companies to monitor their services from around the
            world and inform their users when there are issues.
          </p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 md:gap-8">
            {members.map((member) => (
              <li key={member.name}>
                <Member {...member} />
              </li>
            ))}
          </ul>
        </div>
        <Separator />
        <div className="grid w-full gap-3">
          <p className="text-muted-foreground text-center text-xl font-medium">
            Our Story
          </p>
          <Shell className="mx-auto w-auto px-6 py-6 shadow-md sm:px-8 sm:py-8 md:px-12 md:py-12">
            {story ? (
              <Mdx code={story.body.code} className="prose-li:my-0 mx-auto" />
            ) : null}
          </Shell>
        </div>
      </div>
    </MarketingLayout>
  );
}

const members: MemberProps[] = [
  {
    name: "Thibault Le Ouay",
    role: "Developer",
    image: { src: "/assets/authors/thibault.jpeg" },
  },
  {
    name: "Maximilian Kaske",
    role: "Developer",
    image: { src: "/assets/authors/max.png" },
  },
];
