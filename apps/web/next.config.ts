import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    FEATURE_FLAGS: process.env.FEATURE_FLAGS ?? '',
  },
  async redirects() {
    return [
      {
        source: '/data/test-sets',
        destination: '/data/data-sets',
        permanent: true,
      },
      {
        source: '/data/test-sets/:path*',
        destination: '/data/data-sets/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
