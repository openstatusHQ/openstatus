import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session) redirect("/app");

  return (
    <div className="grid min-h-screen grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <aside className="col-span-1 flex w-full flex-col gap-4 border border-border p-4 backdrop-blur-[2px] md:p-8 xl:col-span-2">
        <Link href="/" className="relative h-8 w-8">
          <Image
            src="/icon.png"
            alt="OpenStatus"
            height={32}
            width={32}
            className="rounded-full border border-border"
          />
        </Link>
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 text-center md:mx-0 md:text-left">
          <div className="mx-auto grid gap-3">
            <h1 className="font-cal text-3xl text-foreground">
              Open Source Monitoring Service
            </h1>
            <p className="text-muted-foreground text-sm">
              Monitor your website or API and create your own status page within
              a couple of minutes. Want to know how it works? <br />
              <br />
              Check out{" "}
              <a
                href="https://github.com/openstatushq/openstatus"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-4 hover:no-underline"
              >
                GitHub
              </a>{" "}
              and let us know your use case!
            </p>
          </div>
        </div>
        <div className="md:h-8" />
      </aside>
      <main className="container col-span-1 mx-auto flex items-center justify-center md:col-span-1 xl:col-span-3">
        {children}
      </main>
    </div>
  );
}
