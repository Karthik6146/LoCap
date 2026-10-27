/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  // FFmpeg processing happens in the worker; the web server stays lean.
  experimental: { serverComponentsExternalPackages: ['@prisma/client'] },
  transpilePackages: ['@clipx/ai', '@clipx/captions', '@clipx/types', '@clipx/database', '@clipx/config', '@clipx/storage'],
  images: {
    remotePatterns: [{ protocol: 'http', hostname: '**' }, { protocol: 'https', hostname: '**' }],
  },

};

export default nextConfig;
