/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  // Enable standalone output for better performance
  output: 'standalone',
  // Disable ESLint during build since we'll handle it separately
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript errors during build for now
  typescript: {
    ignoreBuildErrors: true,
  }
};

module.exports = nextConfig;
