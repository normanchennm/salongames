import type { NextConfig } from "next";

const config: NextConfig = {
  // Static export — required for Azure SWA's free tier. Every page renders
  // at build time, no server runtime. localStorage-first app, so this is
  // the right call even without infra budget considerations.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default config;
