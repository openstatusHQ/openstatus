import type { AppProps } from "next/app";
import { Analytics } from "@vercel/analytics/react";

import "../styles/swagger-dark.css";
import "swagger-ui-react/swagger-ui.css";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}

export default MyApp;
