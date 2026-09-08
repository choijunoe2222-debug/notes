import fs from "node:fs";
import path from "node:path";

const tracePath = path.join(
  process.cwd(),
  ".next",
  "server",
  "app",
  "api",
  "pdf",
  "route.js.nft.json",
);

if (!fs.existsSync(tracePath)) {
  throw new Error(`PDF route trace is missing: ${tracePath}`);
}

const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
const normalizedFiles = trace.files.map((file) => file.replaceAll("\\", "/"));
const requiredAssets = [
  "mathjax/es5/tex-svg-full.js",
  "@sparticuz/chromium/bin/chromium.br",
  "@sparticuz/chromium/bin/fonts.tar.br",
  "@sparticuz/chromium/bin/swiftshader.tar.br",
  "@sparticuz/chromium/bin/al2023.tar.br",
];
const missingAssets = requiredAssets.filter(
  (asset) => !normalizedFiles.some((file) => file.endsWith(asset)),
);
const tracedKoreanFonts = normalizedFiles.filter(
  (file) => file.includes("@fontsource-variable/noto-sans-kr/files/") && file.endsWith(".woff2"),
);
const tracedMonospaceFonts = normalizedFiles.filter(
  (file) => file.includes("@fontsource/nanum-gothic-coding/files/") && file.endsWith(".woff2"),
);

if (missingAssets.length > 0) {
  throw new Error(
    `PDF runtime is incomplete. Missing traced Chromium assets: ${missingAssets.join(", ")}`,
  );
}

if (tracedKoreanFonts.length < 120) {
  throw new Error(
    `PDF runtime is incomplete. Expected at least 120 traced Korean font subsets, found ${tracedKoreanFonts.length}.`,
  );
}

if (tracedMonospaceFonts.length < 180) {
  throw new Error(
    `PDF runtime is incomplete. Expected at least 180 traced Korean monospace font subsets, found ${tracedMonospaceFonts.length}.`,
  );
}

console.log(
  `[pdf-runtime] verified ${requiredAssets.length} Chromium assets, ${tracedKoreanFonts.length} Korean text subsets, and ${tracedMonospaceFonts.length} Korean monospace subsets`,
);
