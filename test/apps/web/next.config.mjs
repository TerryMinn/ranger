/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/api", "@repo/auth", "@repo/db"],
};

export default nextConfig;
