import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
