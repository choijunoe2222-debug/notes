export const DRAFT_KEY = "gpt-pdf-maker:draft:v1";

export type Draft = { title: string; content: string; templateId: "engineering"; savedAt: number; originalClipboard?: { text: string; html: string } };

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<Draft, "savedAt">) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() } satisfies Draft));
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}
