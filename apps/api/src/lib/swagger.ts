import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: "src/app/v1",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "OpenStatus API",
        version: "1.0",
      },
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: "apiKey",
            name: "x-openstatus-key",
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  });
  return spec;
};
