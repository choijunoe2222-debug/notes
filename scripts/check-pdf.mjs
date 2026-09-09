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
const ipad = [
  String.raw`\boxed{\dot x=Ax+Bu}`,
  String.raw`\ddot y
=
-\frac{k}{m}y
-\frac{b}{m}\dot y
+\frac1m u`,
  String.raw`\boxed{
x=
\begin{bmatrix}
x_1\\
x_2
\end{bmatrix}
=
\begin{bmatrix}
y\\
\dot y
\end{bmatrix}
}`,
  String.raw`\begin{aligned}
\dot x_1&=x_2\\
\dot x_2&=-\frac{k}{m}x_1-\frac{b}{m}x_2+\frac1m u
\end{aligned}`,
];
const stock = require("markdown-it")();
assert.equal(stock.parse(ipad[1], {})[0].tag, "h1", "Reproduce the original Setext bug");
for (const source of ipad) {
  const result = parseDocument(source);
  assert.equal(result.stats.equations, 1, source);
  assert.doesNotMatch(result.html, /<h1/);
  assert.ok(result.html.includes(stock.utils.escapeHtml(source)), "The complete source, including equals signs, survives");
}
for (const source of ["A = B", "일반 문장 안의 등호: A = B", "```text\n" + ipad[0] + "\n=\n```", "    " + ipad[0], "Use \\frac{x}{y} here", "설명 \\dot y", String.raw`\boxed{unclosed`, String.raw`\begin{matrix}x\end{aligned}`]) {
  assert.equal(parseDocument(source).stats.equations, 0, source);
}
assert.match(parseDocument("정상 제목\n===").html, /<h1>정상 제목/);
for (const source of [String.raw`문장 안에서 \(x_1=y\)라고 한다.`, "$x+y$", "# 제목\n\n일반 문장\n\n- 목록 1\n- 목록 2\n\n" + String.raw`\[\dot x=Ax+Bu\]`]) {
  assert.equal(parseDocument(source).stats.equations, 1);
}
const diagram = "┌──────────────┐\n│ 입력 → 출력  │\n└──────────────┘\n(P)  x_y  \\alpha  ===\n";
const input = [
  "# 호환성 검증", "일반 괄호 (P), (1), 가격 $5와 $10은 그대로입니다.",
  "핵심 정리: \\(\\boxed{\\text{박스 안 한글 보존}}\\)",
  "## 수식", "\\[", "\\frac{\\partial u}{\\partial t} + \\nabla \\cdot u = 0", "\\]",
  "## iPad 구분자 복구", ...ipad,
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
  const { launchBrowser } = load("src/lib/pdf/launchBrowser.ts");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ path: path.resolve("node_modules/turndown/dist/turndown.js") });
    const clipboardCode = ts.transpileModule(fs.readFileSync("src/lib/parser/clipboard.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const results = await page.evaluate(({ code, samples }) => {
      const loaded = { exports: {} };
      new Function("require", "module", "exports", code)(() => window.TurndownService, loaded, loaded.exports);
      const convert = loaded.exports.clipboardToMarkdown;
      return [
        ...samples.map(text => convert({ text, html: "<p>" + text.replaceAll("\n", "<br>") + "</p>" })),
        convert({ text: "질량 m**", html: "<p><strong>질량 m</strong>이 움직인다.</p>" }),
        convert({ text: "x=y", html: '<div class="katex-display"><span class="katex"><math><semantics><annotation encoding="application/x-tex">\\boxed{x=y}</annotation></semantics></math><span>duplicate</span></span></div>' }),
        convert({ text: "", html: "<table><tr><th>제목</th></tr><tr><td>값</td></tr></table>" }),
      ];
    }, { code: clipboardCode, samples: ipad });
    assert.deepEqual(results.slice(0, ipad.length), ipad, "HTML must not double-escape plain TeX");
    assert.match(results[4], /\*\*질량 m\*\*/);
    assert.equal(parseDocument(results[5]).stats.equations, 1, results[5]);
    assert.doesNotMatch(results[5], /duplicate/);
    assert.equal(parseDocument(results[6]).stats.tables, 1);
    console.log("[check-pdf] real-browser clipboard format checks passed");
  } finally { await browser.close(); }
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
  const recovered = await generatePdf(buildPdfHtml("iPad 수식 복구", ipad.join("\n\n"), fs.readFileSync("public/templates/engineering.css", "utf8"), await getEmbeddedKoreanFontCss()).html);
  assert.deepEqual(recovered.warnings, [], "Every recovered iPad equation must render, not fall back to raw TeX");
  fs.writeFileSync("tmp/pdfs/regression/ipad-recovery.pdf", recovered.pdf);
  const huge = buildPdfHtml("너비 검증", "```\n" + "X".repeat(1000) + "\n```", fs.readFileSync("public/templates/engineering.css", "utf8"), await getEmbeddedKoreanFontCss()).html;
  await assert.rejects(generatePdf(huge), /DIAGRAM_TOO_WIDE/);
  console.log("[check-pdf] real PDF generated; unknown TeX retained; oversize diagram rejected without clipping");
}
