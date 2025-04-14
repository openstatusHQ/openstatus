import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Shell } from "@/components/dashboard/shell";
import { FAQs } from "@/components/marketing/faqs";
import { PricingSlider } from "@/components/marketing/pricing/pricing-slider";
import { alternativesConfig as config } from "@/config/alternatives";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@openstatus/ui/src/components/breadcrumb";
import { Button } from "@openstatus/ui/src/components/button";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ComparisonTable } from "../_components/comparison-table";

export async function generateStaticParams() {
  return Object.keys(config).map((slug) => ({ slug }));
}
export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const { slug } = await props.params;
  const alternative = config[slug as keyof typeof config];

  if (!alternative) return;

  const { name } = alternative;
  const title = `${name} vs. OpenStatus`;
  const description = `Looking for a ${name} alternative? OpenStatus is an open-source alternative to ${name}. Try it out for free.`;

  const encodedTitle = encodeURIComponent(title);
  // TODO: check if there is a better wording
  const encodedDescription = encodeURIComponent(
    "Compare both and pick what fits best to you.",
  );

  return {
    ...defaultMetadata,
    title,
    description,
    openGraph: {
      ...ogMetadata,
      title,
      description,
      url: `https://www.openstatus.dev/compare/${slug}`,
      images: [
        {
          url: `https://openstatus.dev/api/og?title=${encodedTitle}&description=${encodedDescription}`,
        },
      ],
    },
    twitter: {
      ...twitterMetadata,
      title,
      description,
      images: [
        {
          url: `https://openstatus.dev/api/og?title=${encodedTitle}&description=${encodedDescription}`,
        },
      ],
    },
  };
}
// add to sitemap

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const alternative = config[slug as keyof typeof config];

  if (!alternative) {
    notFound();
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {/* TODO: use the breadcrump component for the changelog and blog and play pages */}
      <Breadcrumb className="px-3 md:px-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/compare">Compare</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{alternative.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="grid gap-12">
        <Shell className="space-y-12">
          <div className="flex flex-col items-center gap-4">
            <Image
              src={alternative.logo}
              alt={alternative.name}
              width={60}
              height={60}
              className="rounded-full overflow-hidden border border-border bg-muted"
            />
            <h1 className="text-4xl font-cal text-center">
              {alternative.name} Alternative
            </h1>
            <p className="mx-auto max-w-xl text-muted-foreground text-lg text-center">
              {alternative.description}
            </p>
          </div>
          <ComparisonTable slug={slug} />
        </Shell>
        <Shell className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="font-semibold text-2xl">
              Don't talk to Sales. Talk to Founders.
            </p>
            <p className="text-muted-foreground text-sm">
              We are here to help you with any questions or concerns you may
              have.
            </p>
          </div>
          <div>
            <Button className="w-full" asChild>
              <a
                target="_blank"
                rel="noreferrer"
                href="https://cal.com/team/openstatus/30min"
              >
                Talk to us
              </a>
            </Button>
          </div>
        </Shell>
        {/* FIXME: responsive design */}
        <Shell className="w-full max-w-4xl">
          <PricingSlider />
        </Shell>
        <FAQs />
      </div>
    </div>
  );
}
