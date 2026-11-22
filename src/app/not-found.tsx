/* The fallback for a URL that no locale can serve at all. Anything that does
   reach a locale gets the full 404 in app/[locale]/not-found.tsx. */
export default function NotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem" }}>
        <h1>404</h1>
        <p>This page could not be found.</p>
        <a href="/">cyrus.ai</a>
      </body>
    </html>
  );
}
