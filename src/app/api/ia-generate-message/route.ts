import { NextResponse } from "next/server";

/**
 * Release-safe fallback until authenticated AI generation, abuse prevention,
 * consent and billing controls have passed review.
 *
 * The endpoint is intentionally local-only and never calls a paid API.
 */
const LOCAL_MESSAGES = [
  "Seu registro de hoje pode ajudar a reconhecer padrões com mais clareza.",
  "Se estiver difícil, observe o que está sentindo e procure alguém de confiança.",
  "Pequenos cuidados hoje podem fazer diferença na sua rotina.",
  "Você pode registrar como se sente sem precisar se julgar.",
  "Se precisar de apoio, use os recursos da seção SOS ou procure um profissional.",
];

export async function POST(req: Request) {
  try {
    const size = Number(req.headers.get("content-length") || 0);
    if (size > 4096) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413 });
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== new URL(req.url).host) {
      return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
    }
    const text = await req.text();
    if (text.length > 4096) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413 });
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text || "{}"); } catch {
      return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
    }
    const mood = Number(data.moodValue);
    const index = Number.isFinite(mood) ? Math.min(LOCAL_MESSAGES.length - 1, Math.max(0, Math.floor(mood / 21))) : 0;
    return NextResponse.json({ text: LOCAL_MESSAGES[index], source: "conteudo_local" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ text: LOCAL_MESSAGES[0], source: "conteudo_local" }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
