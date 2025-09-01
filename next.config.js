/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: process.env.ELECTRON_BUILD ? 'out' : 'dist',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Configure asset path for Electron
  assetPrefix: process.env.ELECTRON_BUILD ? './' : '',
  eslint: {
    ignoreDuringBuilds: true
  }
}

module.exports = nextConfig