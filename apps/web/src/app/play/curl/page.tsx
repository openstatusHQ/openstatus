import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import {
  CardContainer,
  CardDescription,
  CardHeader,
  CardIcon,
  CardTitle,
} from "@/components/marketing/card";
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
    <CardContainer>
      <CardHeader>
        <CardIcon icon="terminal" />
        <CardTitle>cURL Builder</CardTitle>
        <CardDescription className="max-w-md">
          An online curl command line builder. Generate curl commands to test
          your API endpoints.
        </CardDescription>
      </CardHeader>
      <div className="mx-auto grid w-full max-w-xl gap-6">
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
  );
}
