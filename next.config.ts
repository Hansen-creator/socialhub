/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! PERINGATAN !!
    // Ini akan membiarkan build berhasil meskipun ada error TypeScript.
    ignoreBuildErrors: true,
  },
}

export default nextConfig;
