import type { NextConfig } from 'next';

/** Keep in sync with `apps/api/app/paths.py` (`WEB_UI_PREFIX`). Empty string = site root. */
const webBasePath = (process.env.WEB_UI_PREFIX ?? '').replace(/\/$/, '');

const nextConfig: NextConfig = {
  // output: 'export', // 移除：生产构建时才需要静态导出，开发模式下会导致高CPU占用
  ...(webBasePath ? { basePath: webBasePath } : {}),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    FEATURE_FLAGS: process.env.FEATURE_FLAGS ?? '',
    NEXT_PUBLIC_WEB_BASE_PATH: webBasePath,
  },
  experimental: {
    // Next.js 16.3+ 内存优化配置
    turbopackMemoryEviction: 'auto',
  },
};

export default nextConfig;
