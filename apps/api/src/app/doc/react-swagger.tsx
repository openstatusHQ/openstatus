"use client";

import SwaggerUI from "swagger-ui-react";

import "swagger-ui-react/swagger-ui.css";

type Props = {
  spec: Record<string, any>;
};

function ReactSwagger({ spec }: Props) {
  return null;
  // FIXME: build error
  // - error Class extends value undefined is not a constructor or null
  // return <SwaggerUI spec={spec} />;
}

export default ReactSwagger;
