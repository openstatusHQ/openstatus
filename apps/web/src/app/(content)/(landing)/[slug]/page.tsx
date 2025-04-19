import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { config } from "@/config/landings";
import { Button } from "@openstatus/ui";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  return Object.keys(config).map((slug) => ({ slug }));
}
export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const { slug } = await props.params;
  const landing = config[slug as keyof typeof config];

  if (!landing) return;

  const { title, description } = landing;

  return {
    ...defaultMetadata,
    title,
    description,
    openGraph: {
      ...ogMetadata,
      title,
      description,
    },
    twitter: {
      ...twitterMetadata,
      title,
      description,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const landing = config[slug as keyof typeof config];

  if (!landing) {
    notFound();
  }

  return (
    <div className="grid gap-12">
      <Hero title={landing.title} description={landing.description} />
      <HeroImage
        srcLight={landing.image.srcLight}
        srcDark={landing.image.srcDark}
        caption={landing.image.caption}
      />
      {landing.blocks.map((block) => block)}
    </div>
  );
}

function Hero({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto my-16 flex max-w-xl flex-col items-center gap-4 md:gap-6">
      <div className="flex flex-col text-center gap-4 md:gap-6">
        <h1 className="font-cal text-5xl leading-tight md:text-6xl">{title}</h1>
        <h2 className="mx-auto max-w-md text-xl text-muted-foreground md:max-w-xl md:text-2xl">
          {description}
        </h2>
      </div>
      <div className="flex gap-2">
        <Button className="rounded-full" asChild>
          <Link href="/app/login">Get Started</Link>
        </Button>
        <Button variant="outline" className="rounded-full" asChild>
          <a href="/cal" rel="noreferrer" target="_blank">
            Book a demo
          </a>
        </Button>
      </div>
    </div>
  );
}

function HeroImage({
  srcLight,
  srcDark,
  caption,
}: {
  srcLight: string;
  srcDark: string;
  caption: string;
}) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative w-full h-[525px] rounded-lg overflow-hidden border">
        <Image
          src={srcLight}
          alt={caption}
          className="object-cover object-top dark:hidden block"
          fill
        />
        <Image
          src={srcDark}
          alt={caption}
          className="object-cover object-top hidden dark:block"
          fill
        />
      </div>
      <figcaption className="text-sm text-muted-foreground text-center">
        {caption}
      </figcaption>
    </figure>
  );
}
