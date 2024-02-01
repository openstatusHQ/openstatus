import { allUnrelateds } from "contentlayer/generated";

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
        <div className="grid w-full gap-3">
          <h1 className="text-foreground font-cal mb-6 text-center text-4xl">
            About OpenStatus
          </h1>

          <Shell className="dark:border-foreground/40 mx-auto w-auto px-6 py-6 shadow-md sm:px-8 sm:py-8 md:px-12 md:py-12">
            {story ? (
              <Mdx
                code={story.body.code}
                className="prose-lg prose-li:my-0 mx-auto"
              />
            ) : null}
          </Shell>
        </div>
      </div>
      <div className="mx-auto grid w-auto  w-full gap-8 px-6 py-6  sm:px-8 sm:py-8 md:px-12 md:py-12">
        <h2 className="text-foreground font-cal mb-6 text-center text-2xl">
          The Team
        </h2>
        <ul className="grid grid-cols-1 place-items-center gap-4  sm:grid-cols-2  sm:gap-6  md:gap-8">
          {members.map((member) => (
            <li key={member.name}>
              <Member {...member} />
            </li>
          ))}
        </ul>
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
