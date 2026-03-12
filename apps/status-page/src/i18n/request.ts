import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    
  experimental: {
    // Relative path(s) to source files
    srcPath: './src',
 
    extract: {
      // Defines which locale to extract to
      sourceLocale: 'en'
    },
 
    messages: {
      // Relative path to the directory
      path: './messages',
 
      // Either 'json', 'po', or a custom format (see below)
      format: 'json',
 
      // Either 'infer' to automatically detect locales based on
      // matching files in `path` or an explicit array of locales
      locales: 'infer'
    }
  }
  };
});
