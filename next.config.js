/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://soefubigjyedirgjcvhs.supabase.co').hostname,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig
