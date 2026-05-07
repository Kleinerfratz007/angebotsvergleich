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
  // Konvention §24.x — Anti-Stale-Chunks-Bug:
  // HTML-Pages dürfen NICHT lange gecacht werden. Sonst zeigt Browser nach
  // Re-Deploy alte HTML mit dead chunk-hashes -> JS-404 -> "kein Menü"-Bug.
  // _next/static/chunks/*.js sind hash-content-addressed (immutable),
  // aber HTML muss revalidiert werden bei jedem Request.
  async headers() {
    return [
      {
        source: '/((?!_next/static).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;
