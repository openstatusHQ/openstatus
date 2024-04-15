import * as React from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = auth();

  if (userId) {
    redirect("/app");
  }
  return (
    <div className="grid min-h-screen grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <aside className="border-border col-span-1 flex w-full flex-col gap-4 border p-3 backdrop-blur-[2px] md:p-6">
        <div className="relative">
          <Image
            src="/icon.png"
            alt="OpenStatus"
            height={30}
            width={30}
            className="border-border rounded-full border"
          />
        </div>
        <div className="flex w-full max-w-lg flex-1 flex-col justify-center text-left">
          <h1 className="font-cal text-foreground mb-3 text-2xl">
            Open Source Monitoring Service
          </h1>
          <p className="text-muted-foreground">
            Monitor your website or API and create your own status page within a
            couple of minutes. Want to know how it works? <br />
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
      </aside>
      <main className="container col-span-1 mx-auto flex items-center justify-center md:col-span-1 xl:col-span-2">
        {children}
      </main>
    </div>
  );
}
