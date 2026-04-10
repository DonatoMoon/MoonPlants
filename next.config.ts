import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "*.supabase.co",
            },
            {
                protocol: "https",
                hostname: "s3.us-central-1.wasabisys.com",
            },
            {
                protocol: "https",
                hostname: "perenual.com",
            }
        ],
    },
};

export default nextConfig;
