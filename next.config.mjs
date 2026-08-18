/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Product art in this phase is local SVG. These remote patterns are pre-authorised
    // so the Hostinger catalog can be plugged in later without a config change.
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.zyrosite.com' },
      { protocol: 'https', hostname: 'images.hostinger.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
