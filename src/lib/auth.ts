import { createHash, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "noteform_access";

export function accessToken(code: string) {
  return createHash("sha256").update(`noteform:${code}`).digest("hex");
}

export function isValidToken(value: string | undefined) {
  const code = process.env.APP_ACCESS_CODE;
  if (!code) return true;
  if (!value) return false;
  const expected = Buffer.from(accessToken(code));
  const received = Buffer.from(value);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
