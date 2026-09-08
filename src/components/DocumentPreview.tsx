"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";

export function DocumentPreview({ blob }: { blob: Blob | null }) {
  if (!blob) return (
    <div className="preview-empty">
      <div className="empty-page-mark" aria-hidden="true" />
      <strong>다운로드할 PDF를 그대로 미리봅니다</strong>
      <p>내용 입력 후 ‘PDF 만들기’를 눌러 주세요.<br />내용을 수정하면 PDF를 다시 생성해야 합니다.</p>
    </div>
  );
  return <PdfPages blob={blob} />;
}

function PdfPages({ blob }: { blob: Blob }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<{ blob: Blob; pdf: PDFDocumentProxy } | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState("");
  const pdf = loaded?.blob === blob ? loaded.pdf : null;

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    void (async () => {
      const pdfjs = await import("pdfjs-dist");
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const data = new Uint8Array(await blob.arrayBuffer());
      if (cancelled) return;
      task = pdfjs.getDocument({ data });
      const document = await task.promise;
      if (!cancelled) { setLoaded({ blob, pdf: document }); setPageNumber(1); }
    })().catch(() => { if (!cancelled) setError("미리보기를 열지 못했습니다. 아래 다운로드 버튼으로 PDF를 확인해 주세요."); });
    return () => { cancelled = true; void task?.destroy(); };
  }, [blob]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let rendering: RenderTask | undefined;
    void (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvas.current) return;
      const viewport = page.getViewport({ scale: 2 });
      canvas.current.width = viewport.width;
      canvas.current.height = viewport.height;
      rendering = page.render({ canvas: canvas.current, viewport });
      await rendering.promise;
    })().catch(() => { if (!cancelled) setError("페이지를 표시하지 못했습니다. PDF를 다운로드해 확인해 주세요."); });
    return () => { cancelled = true; rendering?.cancel(); };
  }, [pdf, pageNumber]);

  return <div className="pdf-viewer">
    <nav className="pdf-toolbar" aria-label="PDF 페이지 이동">
      <button disabled={!pdf || pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)}>이전</button>
      <span aria-live="polite">{pdf ? `${pageNumber} / ${pdf.numPages} 페이지` : "PDF 여는 중…"}</span>
      <button disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber((page) => page + 1)}>다음</button>
    </nav>
    {error && <p role="alert">{error}</p>}
    <div className="pdf-page-scroll"><canvas ref={canvas} aria-label={`PDF ${pageNumber}페이지`} role="img" /></div>
  </div>;
}
