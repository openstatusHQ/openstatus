import type { GetStaticProps, InferGetStaticPropsType } from "next";
import dynamic from "next/dynamic";

import "next-swagger-doc";

import { getApiDocs } from "@openstatus/api-server/src/lib/swagger";

import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic<{
  spec: Record<string, any>;
  // @ts-expect-error
}>(import("swagger-ui-react"), { ssr: false });

function ApiDoc({ spec }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <SwaggerUI spec={spec} />;
}

export const getStaticProps: GetStaticProps = async () => {
  // We should fetch the spec from the API server https://api.openstatus.dev/openapi
  const spec: Record<string, any> = await getApiDocs();
  return {
    props: {
      spec,
    },
  };
};

export default ApiDoc;
