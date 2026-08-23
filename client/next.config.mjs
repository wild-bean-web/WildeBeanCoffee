import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version: appVersion } = JSON.parse(
  readFileSync(join(__dirname, "../version.json"), "utf8"),
);

/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const nextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
