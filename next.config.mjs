/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false; // pdf.js optional dep, not needed in browser
    return config;
  },
};
export default nextConfig;
