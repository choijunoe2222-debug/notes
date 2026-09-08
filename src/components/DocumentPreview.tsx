"use client";
import { useEffect, useRef } from "react";

export function DocumentPreview({ blob }: { blob: Blob | null }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    if (frame.current) frame.current.src = next;
    if (link.current) link.current.href = next;
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  if (!blob) return (
    <div className="preview-empty">
      <div className="empty-page-mark" aria-hidden="true" />
      <strong>다운로드할 PDF를 그대로 미리봅니다</strong>
      <p>내용 입력 후 ‘PDF 만들기’를 눌러 주세요.<br />내용을 수정하면 PDF를 다시 생성해야 합니다.</p>
    </div>
  );
  return <div style={{ height: "100%", minHeight: 525 }}>
    <a ref={link} target="_blank" rel="noopener noreferrer">PDF가 보이지 않으면 새 창에서 열기</a>
    <iframe ref={frame} title="실제 PDF 미리보기" style={{ width: "100%", height: "calc(100% - 30px)", minHeight: 490, border: 0 }} />
  </div>;
}
