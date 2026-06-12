import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const securityHeaders = [
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'self'",
          "form-action 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          "media-src 'self' data: blob:",
          "manifest-src 'self'",
          "worker-src 'self' blob:",
          "connect-src 'self' https://api.openai.com https://api.stripe.com https://api.telegram.org https://graph.facebook.com https://generativelanguage.googleapis.com https://openrouter.ai https://fonts.googleapis.com https://fonts.gstatic.com",
          "frame-src 'self' https://js.stripe.com https://hooks.stripe.com"
        ].join("; ")
      }
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  },
  webpack: (config) => config,
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
