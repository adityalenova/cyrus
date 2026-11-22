import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/* Link, usePathname and useRouter that know the current locale: a link to
   /about from /es/... goes to /es/about, and usePathname() hands back the
   path without the language prefix. */
export const { Link, usePathname, useRouter, redirect, getPathname } = createNavigation(routing);
