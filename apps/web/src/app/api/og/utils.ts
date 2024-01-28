export const SIZE = {
  width: 1200,
  height: 630,
};

export const DEFAULT_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const interMedium = fetch(
  new URL("../../../public/fonts/Inter-Medium.ttf", import.meta.url),
).then((res) => res.arrayBuffer());

export const interRegular = fetch(
  new URL("../../../public/fonts/Inter-Regular.ttf", import.meta.url),
).then((res) => res.arrayBuffer());

export const interLight = fetch(
  new URL("../../../public/fonts/Inter-Light.ttf", import.meta.url),
).then((res) => res.arrayBuffer());

export const calSemiBold = fetch(
  new URL("../../../public/fonts/CalSans-SemiBold.ttf", import.meta.url),
).then((res) => res.arrayBuffer());
