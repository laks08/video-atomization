/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent ffmpeg-static from being bundled
  serverExternalPackages: ['ffmpeg-static'],
  
  // Increase timeout for generating static pages if needed
  staticPageGenerationTimeout: 300,
  
  // Ensure we can use the Vercel Blob
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
};

export default nextConfig;
