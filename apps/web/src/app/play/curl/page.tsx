import {
  CardContainer,
  CardDescription,
  CardHeader,
  CardIcon,
  CardTitle,
} from "@/components/marketing/card";
import { CurlForm } from "../checker/_components/curl-form";
import { searchParamsCache } from "./search-params";

export default function CurlBuilder({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = searchParamsCache.parse(searchParams);

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
            method: params.method || "GET",
            url: params.url || "",
            body: params.body || "",
            verbose: params.verbose || false,
            insecure: params.insecure || false,
            json: params.json || false,
            headers: params.headers || [],
          }}
        />
      </div>
    </CardContainer>
  );
}
