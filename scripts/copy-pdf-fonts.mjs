import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fontPackages = [
  ["@fontsource-variable/noto-sans-kr", "noto-sans-kr"],
  ["@fontsource/nanum-gothic-coding", "nanum-gothic-coding"],
];

await Promise.all(fontPackages.map(async ([packageName, outputName]) => {
  const packageRoot = path.dirname(require.resolve(`${packageName}/package.json`));
  const outputRoot = path.join(process.cwd(), "public", "fonts", outputName);
  await fs.mkdir(outputRoot, { recursive: true });
  await Promise.all([
    fs.copyFile(path.join(packageRoot, "index.css"), path.join(outputRoot, "index.css")),
    fs.cp(path.join(packageRoot, "files"), path.join(outputRoot, "files"), { recursive: true }),
  ]);
}));

console.log("[pdf-fonts] prepared self-hosted Korean text and monospace assets");
await fs.copyFile(path.join(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"), path.join(process.cwd(), "public/pdf.worker.min.mjs"));
