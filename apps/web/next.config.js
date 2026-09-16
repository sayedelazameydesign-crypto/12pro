/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@agi-system/intelligence-fabric',
    '@agi-system/providers',
    '@agi-system/runtime',
    '@agi-system/governance',
    '@agi-system/memory-fabric',
    '@agi-system/mission-ledger',
    '@agi-system/ui'
  ],
  experimental: {
    typedRoutes: false
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3001/api/v1/:path*'
      },
      {
        source: '/api/events/:path*',
        destination: 'http://localhost:3001/api/events/:path*'
      }
    ];
  },
  // Allow preview hosts
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' }
        ]
      }
    ];
  }
};

export default nextConfig;
