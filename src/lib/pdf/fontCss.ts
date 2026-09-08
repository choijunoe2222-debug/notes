import fs from "node:fs/promises";
import path from "node:path";

let embeddedKoreanFontCss: Promise<string> | null = null;

async function embedFontPackage(packageRoot: string) {
  const sourceCss = await fs.readFile(path.join(packageRoot, "index.css"), "utf8");
  const fontReferences = Array.from(
    new Set(Array.from(sourceCss.matchAll(/url\((\.\/files\/[^)]+\.woff2)\)/g), (match) => match[1])),
  );

  const embeddedFonts = await Promise.all(
    fontReferences.map(async (reference) => {
      const fontPath = path.join(packageRoot, reference.replace(/^\.\//, ""));
      const font = await fs.readFile(fontPath);
      return [reference, `data:font/woff2;base64,${font.toString("base64")}`] as const;
    }),
  );

  let result = sourceCss.replaceAll("font-display: swap", "font-display: block");
  for (const [reference, dataUrl] of embeddedFonts) {
    result = result.replaceAll(reference, dataUrl);
  }
  return result;
}

async function buildEmbeddedKoreanFontCss() {
  const packages = [
    path.join(process.cwd(), "node_modules", "@fontsource-variable", "noto-sans-kr"),
    path.join(process.cwd(), "node_modules", "@fontsource", "nanum-gothic-coding"),
  ];
  return (await Promise.all(packages.map(embedFontPackage))).join("\n");
}

export function getEmbeddedKoreanFontCss() {
  embeddedKoreanFontCss ??= buildEmbeddedKoreanFontCss();
  return embeddedKoreanFontCss;
}
