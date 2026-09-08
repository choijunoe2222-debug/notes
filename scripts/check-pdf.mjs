import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Run the real app modules without adding a test framework or separate renderer.
const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} };
  cache.set(file, loaded);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (name) => name.startsWith(".") || name.startsWith("@/")
    ? load((name.startsWith("@/") ? path.resolve("src", name.slice(2)) : path.resolve(path.dirname(file), name)) + ".ts")
    : require(name);
  new Function("require", "module", "exports", code)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const { parseDocument } = load("src/lib/parser/parseDocument.ts");
const diagram = "┌──────────────┐\n│ 입력 → 출력  │\n└──────────────┘\n(P)  x_y  \\alpha  ===\n";
const input = [
  "# 호환성 검증", "일반 괄호 (P), (1), 가격 $5와 $10은 그대로입니다.",
  "핵심 정리: \\(\\boxed{\\text{박스 안 한글 보존}}\\)",
  "## 수식", "\\[", "\\frac{\\partial u}{\\partial t} + \\nabla \\cdot u = 0", "\\]",
  "[", "q'_1 > q'_2=q'_3 > q'_4", "]",
  "| 형상 | 수식 |", "| --- | --- |", "| 원형 | $\\frac{P}{2}$ |",
  "```text\n" + diagram + "```",
  "> **상자 내용**\n> 수식 \\(E=mc^2\\)와 한글 모두 보존",
  "$$\\unknowncommand{원문보존}$$",
  "## 긴 표", "| 행 | 내용 |", "| --- | --- |",
  ...Array.from({ length: 80 }, (_, index) => `| ${index + 1} | 표 본문 ${index + 1} |`),
  "마지막 문장 END-OF-DOCUMENT",
].join("\n\n").replace(/\n\n\|/g, "\n|");
const parsed = parseDocument(input);
assert.match(parsed.html, /일반 괄호 \(P\), \(1\), 가격 \$5와 \$10/);
assert.match(parsed.html, /\(P\)  x_y  \\alpha  ===/);
assert.equal(parseDocument("```\n" + diagram + "```").stats.equations, 0);
assert.match(parsed.html, /data-tex="\\boxed/);
assert.match(parsed.html, /data-tex="\\frac\{P\}\{2\}"/);
assert.match(parseDocument("\\[\nunclosed").html, /\\\[/);
assert.ok(parseDocument("\\(unclosed").warnings.length);
assert.equal(parseDocument("[\nordinary words\n]").stats.equations, 0);
assert.doesNotMatch(parseDocument('<script>alert(1)</script>').html, /<script>/);
assert.match(parseDocument("![alt](http://127.0.0.1/private)").html, /이미지/);
console.log("[check-pdf] parser preservation checks passed");
if (!process.argv.includes("--parser-only")) {
  const { buildPdfHtml } = load("src/lib/pdf/documentHtml.ts");
  const { getEmbeddedKoreanFontCss } = load("src/lib/pdf/fontCss.ts");
  const { generatePdf } = load("src/lib/pdf/generatePdf.ts");
  const html = buildPdfHtml("호환성 검증", input, fs.readFileSync("public/templates/engineering.css", "utf8"), await getEmbeddedKoreanFontCss()).html;
  const { pdf, warnings } = await generatePdf(html);
  assert.ok(pdf.length > 10000);
  assert.ok(warnings.some((warning) => warning.includes("원문 그대로")), "Unsupported TeX must not disappear silently");
  fs.mkdirSync("tmp/pdfs/regression", { recursive: true });
  fs.writeFileSync("tmp/pdfs/regression/compatibility.pdf", pdf);
  fs.writeFileSync("tmp/pdfs/regression/source.md", input);
  const huge = buildPdfHtml("너비 검증", "```\n" + "X".repeat(1000) + "\n```", fs.readFileSync("public/templates/engineering.css", "utf8"), await getEmbeddedKoreanFontCss()).html;
  await assert.rejects(generatePdf(huge), /DIAGRAM_TOO_WIDE/);
  console.log("[check-pdf] real PDF generated; unknown TeX retained; oversize diagram rejected without clipping");
}
