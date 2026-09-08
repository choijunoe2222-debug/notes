import { parseDocument } from "@/lib/parser/parseDocument";
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function buildDocumentBody(title: string, content: string) {
  const parsed = parseDocument(content);
  return { ...parsed, html: '<article><header class="document-header"><p class="eyebrow">STUDY NOTE</p><h1>' + escapeHtml(title || "제목 없는 정리본") + '</h1></header><main>' + parsed.html + '</main></article>' };
}
export function buildPdfHtml(title: string, content: string, stylesheet: string, fontStylesheet = "") {
  const document = buildDocumentBody(title, content);
  const warnings = document.warnings.length ? '<aside class="conversion-warning">' + document.warnings.map(escapeHtml).join("<br>") + "</aside>" : "";
  return { ...document, html: '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + escapeHtml(title) + "</title><style>" + fontStylesheet + "\n" + stylesheet + "</style></head><body>" + warnings + document.html + "</body></html>" };
}
