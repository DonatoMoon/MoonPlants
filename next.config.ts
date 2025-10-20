import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        domains: [
            "scgpmfxgufzxbbkbneor.supabase.co", // <- твій домен з Supabase Storage
        ],
    },
};

export default nextConfig;
