/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/controle',
  env: {
    NEXT_PUBLIC_BASE_PATH: '/controle',
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

export default nextConfig
