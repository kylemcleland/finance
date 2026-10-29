import { hasSession } from "@/lib/session";
import { askClaude, buildAskContext, type AskMessage } from "@/lib/ask";
import { env } from "@/lib/env";

/** Streams Claude's answer as plain text. Body: { messages: [{ role, content }, ...] }, last one from the user. */
export async function POST(request: Request) {
  if (!(await hasSession())) return new Response("Please sign in again.", { status: 401 });
  if (!env.hasAnthropic) return new Response("ANTHROPIC_API_KEY is not set on the site.", { status: 503 });

  const body = (await request.json().catch(() => null)) as { messages?: unknown } | null;
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const messages: AskMessage[] = raw
    .filter((m): m is AskMessage => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim() !== "")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, m.role === "user" ? 1000 : 6000) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages.at(-1)!.role !== "user") return new Response("Ask a question.", { status: 400 });

  const context = await buildAskContext();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const text of askClaude(messages, context)) controller.enqueue(encoder.encode(text));
      } catch (e) {
        console.error("Ask failed", e);
        controller.enqueue(encoder.encode(`\n\n(Something went wrong asking Claude: ${e instanceof Error ? e.message : String(e)})`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
