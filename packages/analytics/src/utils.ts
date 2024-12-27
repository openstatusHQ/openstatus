export function parseInputToProps(
  json: unknown,
  eventProps?: string[],
): Record<string, unknown> {
  if (typeof json !== "object" || json === null) return {};

  if (!eventProps) return {};

  return eventProps.reduce(
    (acc, prop) => {
      if (prop in json) {
        acc[prop] = json[prop as keyof typeof json];
      }
      return acc;
    },
    {} as Record<string, unknown>,
  );
}
