import type { NextConfig } from "next";

// Baseline security headers for every route. frame-ancestors/X-Frame-Options stop clickjacking of the app and /admin.
const securityHeaders=[
  {key:'Content-Security-Policy',value:"frame-ancestors 'none'; base-uri 'self'; object-src 'none'"},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'},
  {key:'Strict-Transport-Security',value:'max-age=63072000; includeSubDomains'},
];

const nextConfig: NextConfig = {
  async headers(){return [{source:'/:path*',headers:securityHeaders}]},
};

export default nextConfig;
