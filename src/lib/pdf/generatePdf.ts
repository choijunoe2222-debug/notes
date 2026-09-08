import path from "node:path";
import { launchBrowser } from "./launchBrowser";

export async function generatePdf(html: string) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (/^(data:|about:)/.test(request.url())) void request.continue();
      else void request.abort();
    });
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(() => {
      Object.assign(window, { MathJax: {
        startup: { typeset: false },
        tex: { packages: { "[-]": ["autoload", "require", "noundefined", "noerrors"] }, maxBuffer: 100000 },
        svg: { fontCache: "local", mtextInheritFont: true, merrorInheritFont: true },
        options: { enableAssistiveMml: false },
      } });
    });
    await page.addScriptTag({ path: path.join(process.cwd(), "node_modules/mathjax/es5/tex-svg-full.js") });
    const warnings = await page.evaluate(async () => {
      const math = (window as unknown as { MathJax: {
        startup: { promise: Promise<void> };
        tex2svgPromise: (tex: string, options: { display: boolean }) => Promise<HTMLElement>;
      } }).MathJax;
      await math.startup.promise;
      await document.fonts.ready;
      const warnings: string[] = [];
      for (const element of document.querySelectorAll<HTMLElement>("[data-tex]")) {
        try {
          const rendered = await math.tex2svgPromise(element.dataset.tex!, { display: element.dataset.display === "true" });
          if (rendered.querySelector('[data-mml-node="merror"]')) throw new Error("Unsupported TeX");
          rendered.querySelectorAll("mjx-assistive-mml,math").forEach((node) => node.remove());
          element.replaceChildren(rendered);
        } catch {
          element.classList.add("math-fallback");
          warnings.push("해석할 수 없는 수식은 원문 그대로 보존했습니다.");
        }
      }
      await document.fonts.ready;
      // Fit the whole monospaced block, never wrap individual diagram lines.
      for (const pre of document.querySelectorAll<HTMLElement>("pre:not(.math-fallback)")) {
        const style = getComputedStyle(pre);
        const available = pre.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const code = pre.querySelector("code") || pre;
        const range = document.createRange();
        range.selectNodeContents(code);
        const width = Math.max(...Array.from(range.getClientRects(), (rect) => rect.width), pre.scrollWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
        if (width > available) {
          const size = parseFloat(style.fontSize) * available / width;
          if (size < 8) throw new Error("DIAGRAM_TOO_WIDE");
          pre.style.fontSize = size + "px";
        }
      }
      // One block taller than a page cannot be kept intact.
      const pageHeight = 267 * 96 / 25.4;
      for (const block of document.querySelectorAll<HTMLElement>("pre,.math-block,blockquote,tr")) {
        if (block.getBoundingClientRect().height > pageHeight) block.style.breakInside = "auto";
        else block.style.breakInside = "avoid";
      }
      if (warnings.length) {
        const notice = document.createElement("aside");
        notice.className = "conversion-warning";
        notice.textContent = [...new Set(warnings)].join(" ");
        document.body.prepend(notice);
      }
      // Don't return a successful PDF when any content still extends off paper.
      for (const element of document.querySelectorAll<HTMLElement>("pre,table,.math-block")) {
        if (element.scrollWidth > element.clientWidth + 2) throw new Error("CONTENT_TOO_WIDE");
      }
      return [...new Set(warnings)];
    });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, tagged: true });
    return { pdf, warnings };
  } finally {
    await browser.close();
  }
}
