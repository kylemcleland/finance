"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Why is dining so high this month?",
  "What were our biggest purchases this month?",
  "How does this month compare with last month?",
  "What did Jackie spend on shopping?",
];

export function AskChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const append = (text: string) =>
      setMessages((ms) => ms.map((m, i) => (i === ms.length - 1 ? { ...m, content: m.content + text } : m)));
    try {
      const res = await fetch("/ask/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history }) });
      if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").startsWith("text/plain")) {
        append(res.status === 401 || res.redirected ? "Please sign in again, then ask." : (await res.text().catch(() => "")) || `Something went wrong (${res.status}).`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        append(decoder.decode(value, { stream: true }));
      }
    } catch {
      append("\n\n(The connection dropped. Try again.)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {messages.length === 0 ? (
        <div className="suggest">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="pill" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      ) : (
        <div className="chat">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.content || (busy && i === messages.length - 1 ? <span className="meta">Looking through your transactions…</span> : null)}
            </div>
          ))}
        </div>
      )}
      <div ref={end} />
      <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} rows={2}
          placeholder={messages.length ? "Ask a follow-up…" : "Ask about your spending…"} aria-label="Question"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }} />
        <button type="submit" className="primary" disabled={busy || !input.trim()}>{busy ? "…" : "Ask"}</button>
      </form>
      {messages.length ? <button type="button" className="linkish" onClick={() => setMessages([])} disabled={busy}>Start over</button> : null}
      <div className="sub">Claude sees the last six months of totals and every purchase from the last three months. Each new conversation costs a few cents in API credits; follow-ups are cheaper.</div>
    </>
  );
}
