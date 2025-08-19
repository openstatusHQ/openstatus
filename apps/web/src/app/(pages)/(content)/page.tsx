import { AlertCard } from "@/components/marketing/alert/card";
import { CLICard } from "@/components/marketing/cli/card";
import { Hero } from "@/components/marketing/hero";
import { BottomCTA, MiddleCTA } from "@/components/marketing/in-between-cta";
import { LatestChangelogs } from "@/components/marketing/lastest-changelogs";
import { MonitoringCard } from "@/components/marketing/monitor/card";
import { Partners } from "@/components/marketing/partners";
import { Stats } from "@/components/marketing/stats";
import { StatusPageCard } from "@/components/marketing/status-page/card";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Organization, Product, WebPage, WithContext } from "schema-dts";

export const revalidate = 600;

const jsonLdProduct: WithContext<Product> = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "openstatus",
  description: "Open-source uptime and synthetic monitoring with status pages.",
  brand: {
    "@type": "Brand",
    name: "openstatus",
    logo: "https://openstatus.dev/assets/logos/OpenStatus-Logo.svg",
  },
  offers: Object.entries(allPlans).map(([_, value]) => ({
    "@type": "Offer",
    price: value.price.USD,
    name: value.title,
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  })),
};

const jsonLdOrganization: WithContext<Organization> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "openstatus",
  url: "https://openstatus.dev",
  logo: "https://openstatus.dev/assets/logos/OpenStatus-Logo.svg",
  sameAs: [
    "https://github.com/openstatushq",
    "https://linkedin.com/company/openstatus",
    "https://bsky.app/profile/openstatus.dev",
    "https://x.com/openstatushq",
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "Support",
      email: "ping@openstatus.dev",
    },
  ],
};

const jsonLDWebpage: WithContext<WebPage> = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "openstatus",
  description: "Open-source uptime and synthetic monitoring with status pages.",
  url: "https://openstatus.dev",
  image: "https://openstatus.dev/assets/logos/OpenStatus-Logo.svg",
  headline: "Showcase your uptime with a status page",
};

export default async function LandingPage() {
  return (
    <>
      <div className="grid gap-12">
        <Hero />
        <Partners />
        <MonitoringCard />
        <Stats />
        <MiddleCTA />
        <StatusPageCard />
        <CLICard />
        <AlertCard />
        <BottomCTA />
        <LatestChangelogs />
      </div>

      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLdProduct).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLdOrganization).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDWebpage).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
