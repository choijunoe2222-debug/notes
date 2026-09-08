"use client";

import { FileText, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    setLoading(false);
    if (!response.ok) {
      setError("접근 코드가 올바르지 않습니다.");
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <span className="login-brand"><FileText size={20} /> NOTEFORM</span>
        <div className="login-icon"><LockKeyhole size={24} /></div>
        <h1>개인 문서함에 접속</h1>
        <p>설정된 접근 코드를 입력하면 30일 동안 이 기기에서 사용할 수 있습니다.</p>
        <form onSubmit={submit}>
          <label htmlFor="access-code">접근 코드</label>
          <input id="access-code" type="password" value={code} onChange={(event) => setCode(event.target.value)} autoFocus autoComplete="current-password" placeholder="접근 코드를 입력하세요" />
          {error && <span className="login-error">{error}</span>}
          <button disabled={!code || loading}>{loading ? "확인 중…" : "계속하기"}</button>
        </form>
      </section>
    </main>
  );
}
