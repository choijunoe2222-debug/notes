import TurndownService from "turndown";

export type ClipboardSource = { text: string; html: string };

export function clipboardToMarkdown({ text, html }: ClipboardSource) {
  if (!html) return text;
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script,style,noscript").forEach((node) => node.remove());
  const math = new Map<string, string>();
  for (const annotation of document.querySelectorAll('annotation[encoding="application/x-tex"]')) {
    const container = annotation.closest(".katex") || annotation.closest("math");
    if (!container || !annotation.textContent) continue;
    const display = !!container.closest('.katex-display, [display="block"]');
    const key = "MATHSOURCE" + math.size + "TOKEN";
    math.set(key, display ? "\n\n$$\n" + annotation.textContent + "\n$$\n\n" : "\\(" + annotation.textContent + "\\)");
    container.replaceWith(document.createTextNode(key));
  }
  // A copy-code button already provides Markdown; don't escape it a second time.
  if (!math.size && /^(?:#{1,6}\s|```|~~~|\$\$|\\\[)/m.test(text)) return text;
  const converter = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  converter.addRule("table", {
    filter: "table",
    replacement: (_content, node) => {
      const rows = Array.from((node as HTMLTableElement).rows).map((row) =>
        Array.from(row.cells).map((cell) => converter.turndown(cell.innerHTML).replace(/\|/g, "\\|").replace(/\n/g, " ")));
      if (!rows.length) return "";
      const width = Math.max(...rows.map((row) => row.length));
      const row = (cells: string[]) => "| " + Array.from({ length: width }, (_, index) => cells[index] || "").join(" | ") + " |";
      return "\n\n" + [row(rows[0]), row(Array(width).fill("---")), ...rows.slice(1).map(row)].join("\n") + "\n\n";
    },
  });
  let result = converter.turndown(document.body);
  for (const [key, value] of math) result = result.replaceAll(key, value);
  return result || text;
}
