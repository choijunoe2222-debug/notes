import fs from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { buildPdfHtml } from "@/lib/pdf/documentHtml";
import { getEmbeddedKoreanFontCss } from "@/lib/pdf/fontCss";
import { generatePdf } from "@/lib/pdf/generatePdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const cookieStore = await cookies();
  if (!isValidToken(cookieStore.get(AUTH_COOKIE)?.value)) {
    return NextResponse.json({ error: "접근 인증이 필요합니다." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { title?: string; content?: string; templateId?: string } | null;
  const title = typeof payload?.title === "string" ? payload.title.trim().slice(0, 120) || "강의 정리본" : "강의 정리본";
  const content = typeof payload?.content === "string" ? payload.content : "";

  if (!content.trim()) return NextResponse.json({ error: "변환할 정리본을 입력해 주세요." }, { status: 400 });
  if (content.length > 100_000) return NextResponse.json({ error: "입력 내용은 100,000자까지 지원합니다." }, { status: 413 });
  if (payload?.templateId && payload.templateId !== "engineering") {
    return NextResponse.json({ error: "지원하지 않는 문서 형식입니다." }, { status: 400 });
  }

  try {
    console.info("[pdf] generation started", { requestId, contentLength: content.length });
    const [stylesheet, fontStylesheet] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "public", "templates", "engineering.css"), "utf8"),
      getEmbeddedKoreanFontCss(),
    ]);
    const document = buildPdfHtml(title, content, stylesheet, fontStylesheet);
    const { pdf, warnings } = await generatePdf(document.html);
    const safeAscii = title.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 60) || "study-note";
    const encodedTitle = encodeURIComponent(`${title}.pdf`);

    console.info("[pdf] generation completed", {
      requestId,
      durationMs: Date.now() - startedAt,
      bytes: pdf.byteLength,
    });

    return new Response(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeAscii}.pdf"; filename*=UTF-8''${encodedTitle}`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
        "X-PDF-Warnings": encodeURIComponent([...document.warnings, ...warnings].join(" ")),
      },
    });
  } catch (cause) {
    if (cause instanceof Error && /DIAGRAM_TOO_WIDE|CONTENT_TOO_WIDE/.test(cause.message)) {
      return NextResponse.json({ error: "페이지 너비를 넘는 도표가 있어 PDF 생성을 멈췄습니다. 내용을 자르지 않도록 도표를 나누거나 긴 코드 줄을 줄여 주세요." }, { status: 422 });
    }
    const error = cause instanceof Error
      ? { name: cause.name, message: cause.message, stack: cause.stack }
      : { message: String(cause) };
    console.error("[pdf] generation failed", {
      requestId,
      durationMs: Date.now() - startedAt,
      error,
    });
    return NextResponse.json(
      {
        error: `PDF 생성 엔진을 실행하지 못했습니다. 잠시 후 다시 시도해 주세요. (오류 ID: ${requestId.slice(0, 8)})`,
        requestId,
      },
      { status: 500, headers: { "X-Request-Id": requestId } },
    );
  }
}
