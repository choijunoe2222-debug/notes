import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./node_modules/@fontsource-variable/noto-sans-kr/index.css",
      "./node_modules/@fontsource-variable/noto-sans-kr/files/**/*.woff2",
      "./node_modules/@fontsource/nanum-gothic-coding/index.css",
      "./node_modules/@fontsource/nanum-gothic-coding/files/**/*.woff2",
      "./node_modules/mathjax/es5/tex-svg-full.js",
    ],
  },
};

export default nextConfig;
