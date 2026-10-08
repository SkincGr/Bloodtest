/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next", // lets a second dev server run without touching the main .next
  webpack: (config) => {
    config.resolve.alias.canvas = false; // pdf.js optional dep, not needed in browser
    return config;
  },
};
export default nextConfig;
