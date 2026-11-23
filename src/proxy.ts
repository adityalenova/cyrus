import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/* Picks the language: the /es prefix wins, then the saved cookie, then the
   browser's Accept-Language on a first visit. The API, the build output and
   anything with a file extension (llms.txt, sitemap.xml, images) are left
   alone. */
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|llms\\.txt|.*\\..*).*)"],
};
