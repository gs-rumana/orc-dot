import type { NextConfig } from "next";

// Fully static site: `next build` writes plain files to `out/`, which
// Firebase Hosting serves. HTTP headers live in firebase.json.
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
