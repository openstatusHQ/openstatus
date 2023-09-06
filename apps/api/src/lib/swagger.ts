import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: "src/app", // define api folder under app folder
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
            name: "x-api-key",
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  });
  return spec;
};
