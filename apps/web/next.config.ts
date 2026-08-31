import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cambeo/engine', '@cambeo/shared'],
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/cards/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  webpack: (config) => {
    // packages use NodeNext .js extensions pointing at .ts sources
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
