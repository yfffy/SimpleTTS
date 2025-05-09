/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000'}/:path*`,
      },
      // Add a rewrite rule for direct outputs access
      {
        source: '/outputs/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000'}/outputs/:path*`,
      },
      // Add a direct route for download URLs
      {
        source: '/download/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000'}/download/:path*`,
      },
    ];
  },
};

module.exports = nextConfig; 