/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // leave empty for now; re-enable reactCompiler later if you install the plugin
  }
};

export default nextConfig;

// Skip lint errors during build to avoid invalid ESLint option failures in Next
export const eslint = {
  ignoreDuringBuilds: true
};
