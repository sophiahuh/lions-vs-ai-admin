import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every admin page is per-user and behind a login wall, so nothing here
  // should be prerendered or cached. Render on each request instead.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
