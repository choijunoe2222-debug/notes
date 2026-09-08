"use client";

import {
  Check,
  ChevronDown,
  ClipboardPaste,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildDocumentBody } from "@/lib/pdf/documentHtml";
import { clearDraft, loadDraft, saveDraft } from "@/lib/storage/localDraft";
import { DocumentPreview } from "./DocumentPreview";
import type { ClipboardSource } from "@/lib/parser/clipboard";

const SAMPLE = `1. 열역학 핵심 개념

열역학 제1법칙은 에너지 보존 법칙을 열역학계에 적용한 것이다. 계에 전달된 열은 내부에너지 변화와 계가 한 일로 나뉜다.

핵심 정리: 닫힌계에서 운동에너지와 위치에너지 변화를 무시하면 공급된 열량은 내부에너지 변화와 경계일의 합이다.

\\[
Q - W = \\Delta U
\\]

1-1. 주요 상태량 비교

구분\t기호\t단위
압력\tP\tPa
체적\tV\tm³
온도\tT\tK
내부에너지\tU\tJ

2. 시험 전 체크리스트

- 상태량과 경로함수의 차이를 설명할 수 있는가?
- 닫힌계 에너지 방정식을 쓸 수 있는가?
- 부호 규약을 문제 조건에 맞게 적용할 수 있는가?`;

type Stage = "idle" | "parsing" | "math" | "layout" | "done" | "error";

const STAGE_LABELS: Record<Exclude<Stage, "idle" | "error">, string> = {
  parsing: "문서 구조 분석 중",
  math: "수식 렌더링 중",
  layout: "A4 페이지 구성 중",
  done: "PDF 생성 완료",
};

export function DocumentEditor() {
  const [title, setTitle] = useState("강의 정리본");
  const [content, setContent] = useState("");
  const [activeMobileTab, setActiveMobileTab] = useState<"editor" | "preview">("editor");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; title: string; content: string } | null>(null);
  const pdfBlob = result?.title === title && result?.content === content ? result.blob : null;
  const [originalClipboard, setOriginalClipboard] = useState<ClipboardSource | undefined>();
  const [pdfWarnings, setPdfWarnings] = useState("");
  const revision = useRef(0);
  const [toast, setToast] = useState("");
  const hydrated = useRef(false);
  const parsed = useMemo(() => buildDocumentBody(title, content), [title, content]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const draft = loadDraft();
      if (draft) {
        setTitle(draft.title);
        setContent(draft.content);
        setOriginalClipboard(draft.originalClipboard);
      }
      hydrated.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const timer = window.setTimeout(() => {
      try { saveDraft({ title, content, templateId: "engineering", originalClipboard }); }
      catch { setToast("자동 저장 공간이 부족합니다. 원문을 별도로 저장해 주세요."); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [title, content, originalClipboard]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function pasteFromClipboard() {
    try {
      let text = "", html = "";
      if (navigator.clipboard.read) {
        for (const item of await navigator.clipboard.read()) {
          if (item.types.includes("text/plain")) text += await (await item.getType("text/plain")).text();
          if (item.types.includes("text/html")) html += await (await item.getType("text/html")).text();
        }
      } else text = await navigator.clipboard.readText();
      await insertClipboard({ text, html }, content.length, content.length);
      setToast("클립보드 내용을 붙여 넣었습니다.");
    } catch {
      setToast("브라우저의 클립보드 권한을 허용해 주세요.");
    }
  }

  function invalidatePdf() {
    revision.current++;
    setResult(null);
    setStage("idle");
    setError("");
    setPdfWarnings("");
  }

  async function insertClipboard(source: ClipboardSource, start: number, end: number) {
    const currentRevision = revision.current;
    const { clipboardToMarkdown } = await import("@/lib/parser/clipboard");
    if (currentRevision !== revision.current) return;
    const pasted = clipboardToMarkdown(source);
    if (content.length - (end - start) + pasted.length > 100000 || source.html.length > 1000000) {
      setToast("붙여넣기 용량을 초과했습니다. 내용을 나누어 붙여 주세요.");
      return;
    }
    invalidatePdf();
    setOriginalClipboard(source);
    setContent((current) => current.slice(0, start) + pasted + current.slice(end));
  }

  function downloadOriginal() {
    const blob = new Blob([JSON.stringify(originalClipboard, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "붙여넣기-원본.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function resetDraft() {
    if (!window.confirm("작성 중인 제목과 내용을 모두 지울까요?")) return;
    clearDraft();
    setTitle("강의 정리본");
    setContent("");
    setOriginalClipboard(undefined);
    invalidatePdf();
    setStage("idle");
  }

  function clearContent() {
    if (!content || !window.confirm("붙여 넣은 정리본 내용을 모두 지울까요?")) return;
    setContent("");
    setOriginalClipboard(undefined);
    invalidatePdf();
    setStage("idle");
    setError("");
    setToast("정리본 내용을 모두 지웠습니다.");
  }

  async function createPdf() {
    if (!content.trim() || stage === "parsing" || stage === "math" || stage === "layout") return;
    setError("");
    setResult(null);
    setPdfWarnings("");
    const requestRevision = revision.current;
    setStage("parsing");
    const mathTimer = window.setTimeout(() => { if (requestRevision === revision.current) setStage("math"); }, 650);
    const layoutTimer = window.setTimeout(() => { if (requestRevision === revision.current) setStage("layout"); }, 1600);
    try {
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, templateId: "engineering" }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "PDF를 생성하지 못했습니다.");
      }
      const blob = await response.blob();
      if (requestRevision !== revision.current) return;
      setResult({ blob, title, content });
      setPdfWarnings(decodeURIComponent(response.headers.get("X-PDF-Warnings") || ""));
      setStage("done");
    } catch (cause) {
      if (requestRevision !== revision.current) return;
      setError(cause instanceof Error ? cause.message : "알 수 없는 오류가 발생했습니다.");
      setStage("error");
    } finally {
      window.clearTimeout(mathTimer);
      window.clearTimeout(layoutTimer);
    }
  }

  function downloadPdf() {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(title || "강의_정리본").replace(/[\\/:*?"<>|]/g, "_")}.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function sharePdf() {
    if (!pdfBlob) return;
    const file = new File([pdfBlob], `${title || "강의 정리본"}.pdf`, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
    } else {
      downloadPdf();
      setToast("이 브라우저는 파일 공유를 지원하지 않아 다운로드했습니다.");
    }
  }

  const isGenerating = ["parsing", "math", "layout"].includes(stage);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark"><FileText size={18} strokeWidth={2.2} /></span>
          <div><strong>NOTEFORM</strong><span>GPT 정리본 → PDF</span></div>
        </div>
        <div className="header-actions">
          <span className="save-state"><Check size={13} /> 자동 저장됨</span>
          <button className="icon-button" onClick={resetDraft} title="초기화" aria-label="초기화"><RotateCcw size={17} /></button>
        </div>
      </header>

      <section className="workspace-heading">
        <div>
          <p className="section-kicker"><Sparkles size={14} /> PRINT-READY STUDY NOTES</p>
          <h1>붙여넣기만 하면, 읽기 좋은 PDF로.</h1>
          <p>GPT가 만든 긴 정리본과 LaTeX 수식을 A4 학습 노트로 자동 정돈합니다.</p>
        </div>
        <div className="template-control">
          <label htmlFor="template">문서 형식</label>
          <div className="select-shell">
            <select id="template" defaultValue="engineering" aria-label="문서 형식">
              <option value="engineering">공학 강의 정리 · A4 2단</option>
            </select>
            <ChevronDown size={15} />
          </div>
        </div>
      </section>

      <nav className="mobile-tabs" aria-label="작업 화면">
        <button className={activeMobileTab === "editor" ? "active" : ""} onClick={() => setActiveMobileTab("editor")}>내용 입력</button>
        <button className={activeMobileTab === "preview" ? "active" : ""} onClick={() => setActiveMobileTab("preview")}>미리보기</button>
      </nav>

      <section className="workspace-grid">
        <div className={`editor-panel ${activeMobileTab !== "editor" ? "mobile-hidden" : ""}`}>
          <div className="panel-title"><div><span>01</span><strong>원문 입력</strong></div><span>{content.length.toLocaleString()}자</span></div>
          <label className="field-label" htmlFor="document-title">문서 제목</label>
          <input id="document-title" className="title-input" value={title} onChange={(event) => { invalidatePdf(); setTitle(event.target.value); }} maxLength={120} placeholder="예: 열역학 중간고사 핵심 정리" />
          <div className="content-label-row">
            <label className="field-label" htmlFor="document-content">GPT 정리본</label>
            <div className="content-label-actions">
              {content && <button className="text-button clear-button" onClick={clearContent}><Trash2 size={14} /> 모두 지우기</button>}
              {originalClipboard && <button className="text-button" onClick={downloadOriginal}>붙여넣기 원본 저장</button>}
              <button className="text-button" onClick={() => { invalidatePdf(); setContent(SAMPLE); }}><WandSparkles size={14} /> 예시 불러오기</button>
            </div>
          </div>
          <div className="textarea-shell">
            <textarea id="document-content" value={content}
              onChange={(event) => { invalidatePdf(); setContent(event.target.value); }}
              onPaste={(event) => {
                const source = { text: event.clipboardData.getData("text/plain"), html: event.clipboardData.getData("text/html") };
                if (!source.text && !source.html) return;
                event.preventDefault();
                void insertClipboard(source, event.currentTarget.selectionStart, event.currentTarget.selectionEnd)
                  .catch(() => setToast("붙여넣기를 처리하지 못했습니다. 원본 Markdown을 붙여 주세요."));
              }}
              placeholder={"AI 답변이나 원본 Markdown을 붙여 넣으세요.\n\n• Markdown 제목·표·인용 상자 지원\n• \\[ ... \\], \\( ... \\), $$ ... $$, $ ... $ 수식 지원\n• 문자 그림은 코드 블록(```) 안에 넣어 주세요.\n• ‘PDF 만들기’ 후 실제 PDF를 확인할 수 있습니다."} maxLength={100000} />
            {!content && <button className="paste-button" onClick={pasteFromClipboard}><ClipboardPaste size={17} /> 클립보드에서 붙여넣기</button>}
          </div>
          <div className="editor-meta">
            <span>최대 100,000자</span>
            <span>표 {parsed.stats.tables} · 수식 {parsed.stats.equations} · 체크 {parsed.stats.checklists}</span>
          </div>
          {parsed.warnings.length > 0 && <div className="warning-strip">{parsed.warnings.join(" ")}</div>}
        </div>

        <div className={`preview-panel ${activeMobileTab !== "preview" ? "mobile-hidden" : ""}`}>
          <div className="panel-title"><div><span>02</span><strong>실제 PDF 미리보기</strong></div><span className="a4-badge">A4 · 2단 PDF</span></div>
          <div className="preview-wrap"><DocumentPreview blob={pdfBlob} /></div>
        </div>
      </section>

      <section className="action-bar">
        <div className="privacy-note"><span className="privacy-dot" /><div><strong>문서는 서버에 저장되지 않습니다</strong><span>PDF 생성 요청이 끝나면 입력 데이터는 즉시 폐기됩니다.</span></div></div>
        <div className="action-buttons">
          <button className="secondary-button mobile-preview-button" onClick={() => setActiveMobileTab("preview")}><Eye size={17} /> 미리보기</button>
          <button className="primary-button" onClick={createPdf} disabled={!content.trim() || isGenerating}>
            {isGenerating ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}
            {isGenerating ? "PDF 만드는 중" : "PDF 만들기"}
          </button>
        </div>
      </section>

      {stage !== "idle" && (
        <section className={`generation-card ${stage === "error" ? "error" : ""}`} aria-live="polite">
          <div className="generation-icon">{stage === "done" ? <Check size={20} /> : stage === "error" ? "!" : <LoaderCircle className="spin" size={20} />}</div>
          <div className="generation-copy">
            <strong>{stage === "error" ? "PDF 생성 중 문제가 생겼습니다" : STAGE_LABELS[stage as Exclude<Stage, "idle" | "error">]}</strong>
            <span>{stage === "error" ? error : stage === "done" ? "다운로드하거나 다른 앱으로 바로 공유할 수 있습니다." : "수식과 페이지 나눔을 확인하고 있습니다."}</span>
          </div>
          {stage === "done" && pdfBlob && <div className="result-actions"><button onClick={downloadPdf}><Download size={15} /> 다운로드</button><button onClick={sharePdf}><Share2 size={15} /> 공유</button></div>}
          {stage === "error" && <button className="retry-button" onClick={createPdf}>다시 시도</button>}
        </section>
      )}

      {pdfWarnings && <div className="warning-strip" role="status">{pdfWarnings}</div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
