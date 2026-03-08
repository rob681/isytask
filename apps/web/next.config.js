/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@isytask/api", "@isytask/db", "@isytask/shared"],
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

module.exports = nextConfig;
