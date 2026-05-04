/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/angebotsvergleich",
  assetPrefix: "/angebotsvergleich",
  output: "standalone",
  reactStrictMode: true,
  // pdf-parse hat node_modules side-effect, muss extern sein
  serverExternalPackages: ["pdf-parse", "@anthropic-ai/sdk"],
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default nextConfig;
