export function formatMilliseconds(ms: number) {
  return `${Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "millisecond",
  }).format(ms)}`;
}
