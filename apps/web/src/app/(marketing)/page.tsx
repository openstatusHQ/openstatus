import { HowItWorks } from "@/components/marketing/how-it-works";

function Hero() {
  return (
    <section className="w-full py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
          Open-source uptime monitoring
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Monitor your websites and APIs with confidence. Beautiful status pages
          included.
        </p>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="w-full py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Features
        </h2>
        <p className="mt-3 text-muted-foreground md:text-lg">
          Everything you need to monitor your infrastructure
        </p>
      </div>
    </section>
  );
}

export default function MarketingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <Hero />
      <HowItWorks />
      <Features />
    </main>
  );
}
