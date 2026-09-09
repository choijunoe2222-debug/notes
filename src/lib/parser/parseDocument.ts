import MarkdownIt from "markdown-it";

export type ParsedDocument = {
  html: string;
  warnings: string[];
  stats: { characters: number; tables: number; equations: number; checklists: number };
};
const md = new MarkdownIt({ html: false, breaks: true, linkify: true, typographer: false });
const escape = md.utils.escapeHtml;
// CJK fallback fonts draw these symbols two cells wide; keep diagram columns stable.
const renderCode = (source: string) => '<pre><code>' + escape(source).replace(/[\u2190-\u21ff\u2500-\u257f]/g, (symbol) => '<span class="diagram-cell"><span>' + symbol + '</span></span>') + '</code></pre>';
md.renderer.rules.fence = (tokens, index) => renderCode(tokens[index].content);
md.renderer.rules.code_block = (tokens, index) => renderCode(tokens[index].content);
type Environment = { warnings: string[] };

// ponytail: only recover isolated, balanced TeX blocks; ambiguous prose stays literal.
export function isBareMath(source: string) {
  if (/\\[()[\]]|\$|`/.test(source)) return false;
  if (!/\\(?:[A-Za-z]+|[,;! ])|[A-Za-z][_^][{\dA-Za-z]|\d[^\n]*[=]|[=]\s*\[?\d/.test(source)) return false;
  if (/\\\\[A-Za-z]/.test(source)) return false;
  let depth = 0;
  const environments: string[] = [];
  for (const match of source.matchAll(/\\begin\{([^}]+)\}|\\end\{([^}]+)\}|\\[^A-Za-z]|[{}]/g)) {
    if (match[1]) environments.push(match[1]);
    else if (match[2]) { if (environments.pop() !== match[2]) return false; }
    else if (match[0] === "{") depth++;
    else if (match[0] === "}" && --depth < 0) return false;
  }
  if (depth || environments.length) return false;
  const symbols = source.replace(/\\(?:text|mathrm|operatorname)\{[^{}]*\}/g, " ")
    .replace(/\\(?:begin|end)\{[^{}]*\}/g, "")
    .replace(/\\[A-Za-z]+/g, " ");
  return !/[^A-Za-z0-9\s{}()[\]+\-*/=<>^_.,:;!|'\\&%]/.test(symbols)
    && !/[A-Za-z]{3,}/.test(symbols);
}

md.block.ruler.before("lheading", "bare_math", (state, start, end, silent) => {
  if (state.sCount[start] - state.blkIndent >= 4) return false;
  let last = start;
  while (last < end && !state.isEmpty(last) && state.sCount[last] >= state.blkIndent) last++;
  const source = state.getLines(start, last, state.blkIndent, false).trimEnd();
  const diagram = source.includes("\n") && (source.match(/[\u2500-\u259f]/g)?.length ?? 0) >= 3 && !/\\[A-Za-z]+|[`$]/.test(source);
  if (!diagram && !isBareMath(source)) return false;
  if (silent) return true;
  const token = state.push(diagram ? "code_block" : "math", "", 0);
  token.content = source;
  token.meta = { display: true, source };
  token.map = [start, last];
  (state.env as Environment).warnings.push(diagram ? "문자 그림의 공백과 줄바꿈을 보존했습니다." : "구분자가 없는 독립 LaTeX 블록을 수식으로 복구했습니다.");
  state.line = last;
  return true;
});

// Tokenize before Markdown can consume TeX backslashes and underscores.
md.inline.ruler.before("text", "bare_math_inline", (state, silent) => {
  const rest = state.src.slice(state.pos).split("\n", 1)[0];
  // A whole formula line in a list, or a command-led formula ending at Korean prose.
  const source = isBareMath(rest) ? rest : rest.match(/^\\[A-Za-z]+[A-Za-z0-9\s{}()[\]+\-*/=<>^_.,:;!|'\\&%]*/)?.[0].trimEnd();
  if (!source || !isBareMath(source)) return false;
  if (!silent) {
    const token = state.push("math", "", 0);
    token.content = source;
    token.meta = { display: false, source };
  }
  state.pos += source.length;
  return true;
});
md.inline.ruler.before("escape", "math", (state, silent) => {
  const rest = state.src.slice(state.pos);
  const open = ["\\(", "\\[", "$$", "$"].find((delimiter) => rest.startsWith(delimiter));
  if (!open) return false;
  if (open === "$" && /\s/.test(rest[1] ?? " ")) return false;
  const close = open === "\\(" ? "\\)" : open === "\\[" ? "\\]" : open;
  let end = rest.indexOf(close, open.length);
  while (end > 0 && rest[end - 1] === "\\") end = rest.indexOf(close, end + close.length);
  if (end < 0) {
    if (open.startsWith("\\")) {
      if (!silent) {
        state.push("text", "", 0).content = rest;
        (state.env as Environment).warnings.push("닫히지 않은 수식은 원문 그대로 보존했습니다.");
      }
      state.pos = state.src.length;
      return true;
    }
    return false;
  }
  if (open === "$" && (/\s/.test(rest[end - 1]) || /\d/.test(rest[end + 1] ?? ""))) return false;
  if (!silent) {
    const token = state.push("math", "", 0);
    token.content = rest.slice(open.length, end);
    token.meta = { display: open === "$$" || open === "\\[", source: rest.slice(0, end + close.length) };
  }
  state.pos += end + close.length;
  return true;
});
md.block.ruler.before("fence", "math_block", (state, start, end, silent) => {
  if (state.sCount[start] - state.blkIndent >= 4) return false;
  const line = (n: number) => state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n]);
  const opening = line(start).trim();
  if (!["$$", "\\[", "["].includes(opening)) return false;
  const closing = opening === "\\[" ? "\\]" : opening === "[" ? "]" : "$$";
  let last = start + 1;
  while (last < end && line(last).trim() !== closing) last++;
  const body = state.getLines(start + 1, last, state.blkIndent, false);
  // ponytail: bare brackets are ambiguous; accept only a closed, math-like block.
  if (opening === "[" && (last === end || !/\\[A-Za-z]+|[=^_<>]/.test(body))) return false;
  if (silent) return true;
  const token = state.push(last === end ? "math_source" : "math", "", 0);
  token.content = body;
  token.meta = { display: true, source: state.getLines(start, Math.min(last + 1, end), state.blkIndent, false) };
  token.map = [start, Math.min(last + 1, end)];
  if (last === end) (state.env as Environment).warnings.push("닫히지 않은 수식은 원문 그대로 보존했습니다.");
  if (opening === "[") (state.env as Environment).warnings.push("단독 [ … ] 블록을 수식으로 해석했습니다. 일반 괄호 문장은 바꾸지 않습니다.");
  state.line = Math.min(last + 1, end);
  return true;
}, { alt: ["paragraph", "reference", "blockquote", "list"] });
md.renderer.rules.math = (tokens, index) => {
  const token = tokens[index];
  const tag = token.meta.display ? "div" : "span";
  return "<" + tag + ' class="math-' + (token.meta.display ? "block" : "inline") + '" data-tex="' + escape(token.content) + '" data-display="' + token.meta.display + '"><span class="math-source">' + escape(token.meta.source) + "</span></" + tag + ">";
};
md.renderer.rules.math_source = (tokens, index) => '<pre class="math-fallback">' + escape(tokens[index].meta.source) + "</pre>";
// Never let pasted Markdown cause the PDF server to fetch arbitrary URLs.
md.renderer.rules.image = (tokens, index, _options, env: Environment) => {
  const token = tokens[index];
  env.warnings.push("외부 이미지는 자동으로 가져오지 않습니다. 이미지 설명과 주소를 보존했습니다.");
  return '<span class="image-source">[이미지: ' + escape(token.content || "설명 없음") + "] " + escape(token.attrGet("src") || "") + "</span>";
};
export function normalizeText(input: string) {
  return input.replace(/\r\n?/g, "\n");
}
md.core.ruler.after("inline", "callouts", (state) => {
  for (let index = 1; index < state.tokens.length - 1; index++) {
    const token = state.tokens[index];
    if (token.type !== "inline" || !/^(핵심 정리|반드시 알아야 할 내용|헷갈리기 쉬운 부분|관련 결함 또는 문제|시험에서 중요해 보이는 이유|시험에서 알아야 할 핵심|발생 원리):/.test(token.content)) continue;
    if (state.tokens[index - 1].type === "paragraph_open") {
      state.tokens[index - 1].tag = "blockquote";
      state.tokens[index + 1].tag = "blockquote";
    }
  }
});
export function parseDocument(input: string): ParsedDocument {
  const env: Environment = { warnings: [] };
  const tokens = md.parse(normalizeText(input), env);
  let tables = 0, equations = 0, checklists = 0;
  for (const token of tokens) {
    if (token.type === "table_open") tables++;
    if (token.type === "math") equations++;
    for (const child of token.children || []) {
      if (child.type === "math") equations++;
      if (child.type === "text" && /^\[[ xX]\]\s/.test(child.content)) checklists++;
    }
  }
  return { html: md.renderer.render(tokens, md.options, env), warnings: [...new Set(env.warnings)],
    stats: { characters: input.length, tables, equations, checklists } };
}
