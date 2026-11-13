import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  // ffmpeg-static exports a native binary path via require() — must not be bundled
  serverExternalPackages: ['ffmpeg-static'],
  // The mobile library banner links here. Temporary until the Hat Trickster page exists.
  async redirects() {
    return [{ source: '/hat-trickster', destination: '/#spotlight', permanent: false }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
