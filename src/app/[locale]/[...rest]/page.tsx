import { notFound } from "next/navigation";

/* Any path no page claims lands here, so the localized 404 in
   app/[locale]/not-found.tsx is the one shown, in the visitor's language. */
export default function CatchAll() {
  notFound();
}
