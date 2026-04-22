/** @type {import('next').NextConfig} */
const devDistSuffix = process.env.NEXT_DEV_DIST_SUFFIX || process.env.PORT || "default";

const nextConfig = {
  distDir: process.env.NODE_ENV === "development"
    ? `.next-dev-${devDistSuffix}`
    : ".next",
};

export default nextConfig;