import { NextResponse } from "next/server";
import { accessToken, AUTH_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { code?: string } | null;
  const configuredCode = process.env.APP_ACCESS_CODE;

  if (!configuredCode || payload?.code !== configuredCode) {
    return NextResponse.json({ error: "접근 코드가 올바르지 않습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, accessToken(configuredCode), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
