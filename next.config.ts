import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const root = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root },
  outputFileTracingIncludes: {
    "/api/reports": ["./public/assets/fonts/PlusJakartaSans-400.ttf", "./public/assets/fonts/PlusJakartaSans-800.ttf"],
  },
  async redirects() {
    return [
      // close the bare-route dead end: /platform lands on Features
      { source: "/platform", destination: "/platform/features", permanent: false },
      // the assistant pages were retired with the rebuild
      { source: "/assistant", destination: "/platform/features", permanent: false },
      { source: "/platform/assistant", destination: "/platform/features", permanent: false },
      // routes removed by the open-source pivot, kept alive for old links and
      // search hits. Temporary rather than permanent so they can be re-pointed.
      { source: "/nova", destination: "/platform/features", permanent: false },
      { source: "/platform/nova", destination: "/platform/features", permanent: false },
      { source: "/hackathons", destination: "/projects", permanent: false },
      { source: "/hackathons/:id", destination: "/projects", permanent: false },
      { source: "/resources", destination: "/skills", permanent: false },
      { source: "/resources/:id", destination: "/skills", permanent: false },
      { source: "/apis", destination: "/skills", permanent: false },
      { source: "/tools", destination: "/skills", permanent: false },
      { source: "/tools/:path*", destination: "/skills", permanent: false },
      { source: "/dashboard/saved", destination: "/dashboard", permanent: false },
      // the two listings swapped names: the archive left /opensource for
      // /projects, and the skills catalog moved from /projects to /skills.
      { source: "/opensource", destination: "/projects", permanent: false },
      { source: "/opensource/:path*", destination: "/projects", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
