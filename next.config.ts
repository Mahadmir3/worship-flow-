/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Prisma ships workerd-specific code: without this, Next bundles it with the
  // node conditions and the client falls back to the (unavailable) native query
  // engine on Cloudflare Workers instead of using the driver adapter.
  // https://opennext.js.org/cloudflare/howtos/workerd
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pg", "@prisma/adapter-pg"],
};

export default nextConfig;
