/* The <html> element lives in app/[locale]/layout.tsx, where the language and
   writing direction are known. This file only passes the page through. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
