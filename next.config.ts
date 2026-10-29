import type { NextConfig } from "next";
import type { Redirect } from "next/dist/lib/load-custom-routes";

/**
 * Visitors who arrive over plain http or on the www name are sent to the
 * canonical address in one hop. Only applies when the site URL is https, so
 * local dev keeps working over http. (Same rule as Hyperzen's next.config.ts.)
 */
function canonicalRedirects(): Redirect[] {
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  if (site.protocol !== "https:") return [];

  const otherHost = site.hostname.startsWith("www.")
    ? site.hostname.slice(4)
    : `www.${site.hostname}`;

  return [
    // The tunnel always reaches the app over http, so the scheme the visitor
    // actually used comes from Cloudflare's CF-Visitor header.
    {
      source: "/:path*",
      has: [{ type: "header", key: "cf-visitor", value: '.*"scheme":"http".*' }],
      destination: `${site.origin}/:path*`,
      permanent: true,
    },
    {
      source: "/:path*",
      has: [{ type: "host", value: otherHost.replace(/\./g, "\\.") }],
      destination: `${site.origin}/:path*`,
      permanent: true,
    },
  ];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    serverActions: {
      // Logo and receipt uploads go through server actions.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Nothing embeds the ERP.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Attendance check-in may ask for location (only when the company
            // turns it on and the employee consents).
            value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          // No includeSubDomains: other sites on sibling subdomains must stay
          // free to choose for themselves.
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
    ];
  },
  async redirects() {
    return canonicalRedirects();
  },
};

export default nextConfig;
