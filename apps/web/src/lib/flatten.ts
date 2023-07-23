/**
 * CREDITS: https://github.com/chronark/highstorm/blob/e903cfc0c9cf2391333a73c7807f49076a413dac/apps/web/lib/flatten.ts
 */
export type FlatObject = Record<string, number | string | boolean | null>;

export function flatten(obj: Record<string, unknown>, prefix = ""): FlatObject {
  const flattened: FlatObject = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      Object.assign(flattened, flatten(value as any, newKey));
    } else {
      flattened[newKey] = value as any;
    }
  }
  return flattened;
}
