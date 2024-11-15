import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Shell } from "@/components/dashboard/shell";
import {
  CardContainer,
  CardDescription,
  CardHeader,
  CardIcon,
  CardTitle,
} from "@/components/marketing/card";
import { BottomCTA } from "@/components/marketing/in-between-cta";
import type { Metadata } from "next";
import { CurlForm } from "./_components/curl-form";

const title = "cURL Builder";
const description =
  "An online curl command line builder. Generate curl commands to test your API endpoints.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title,
  description,
  twitter: {
    ...twitterMetadata,
    title,
    description,
    images: [`/api/og?title=${title}&description=${description}`],
  },
  openGraph: {
    ...ogMetadata,
    title,
    description,
    images: [`/api/og?title=${title}&description=${description}`],
  },
};

export default function CurlBuilder() {
  return (
    <div className="grid h-full w-full gap-12">
      <CardContainer>
        <CardHeader>
          <CardIcon icon="terminal" />
          <CardTitle>cURL Builder</CardTitle>
          <CardDescription className="max-w-md">
            An online curl command line builder. Generate curl commands to test
            your API endpoints.
          </CardDescription>
        </CardHeader>
        <div className="mx-auto grid w-full max-w-xl gap-8">
          <CurlForm
            defaultValues={{
              method: "GET",
              url: "",
              body: "",
              verbose: false,
              insecure: false,
              json: false,
              headers: [],
            }}
          />
        </div>
      </CardContainer>
      <Informations />
      <BottomCTA />
    </div>
  );
}

function Informations() {
  return (
    <Shell>
      <div className="grid gap-1">
        <h3 className="font-semibold">What is cURL?</h3>
        <p className="text-muted-foreground">
          cURL (Client URL) is a command-line tool and library for transferring
          data with URLs. It supports various protocols like HTTP, HTTPS, FTP,
          and more, making it a versatile choice for testing APIs, downloading
          files, or performing network tasks. Its simplicity and power come from
          the ability to execute complex operations through straightforward
          commands.
        </p>
        <p className="text-muted-foreground">
          cURL is available on most operating systems, including Linux, macOS,
          and Windows.
        </p>
      </div>
    </Shell>
  );
}
