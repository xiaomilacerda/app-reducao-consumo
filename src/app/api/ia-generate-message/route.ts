import { NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * Rota POST /api/ia-generate-message
 * Body: { moodValue: number, moodLabel: string }
 *
 * Behavior:
 * - Try to call OpenAI (chat completion)
 * - If success -> return { text }
 * - If failure (429 or any error) -> pick a fallback message from LOCAL_MESSAGES and return it
 *
 * Obs: ajuste MODEL, TEMPERATURE e MAX_TOKENS conforme desejar.
 */

const MODEL = "gpt-4o-mini";
const LOCAL_MESSAGES = [
  "Respire fundo — você está fazendo o melhor que pode hoje. Um passo de cada vez.",
  "Mesmo em dias difíceis, sua coragem existe. Cuide-se com calma e gentileza.",
  "Você não está sozinho nisso. Pequenos passos contam e você já começou.",
  "Permita-se pausar. Cuidar de você é parte da jornada.",
  "Você tem motivos para seguir — hoje pode ser um dia de cuidado e recuperação.",
  "Se precisar, escreva mais: às vezes botar para fora ajuda a clarear a mente.",
  "Continue registrando — cada entrada é um pequeno mapa do seu progresso."
  // (adicione suas 60 mensagens aqui se quiser)
];

function pickLocalMessage(moodValue:number, moodLabel:string) {
  // simples: escolhe aleatória. Você pode sofisticar: filtrar por moodValue ranges.
  const idx = Math.floor(Math.random() * LOCAL_MESSAGES.length);
  return LOCAL_MESSAGES[idx];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const moodValue = Number(body?.moodValue ?? 50);
    const moodLabel = String(body?.moodLabel ?? "Humor");

    // se não tiver chave, caí direto no fallback
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const fallback = pickLocalMessage(moodValue, moodLabel);
      return NextResponse.json({ text: fallback });
    }

    const client = new OpenAI({ apiKey });

    const prompt = `
Gere uma mensagem curta, acolhedora e empática para um diário emocional.
Use segunda pessoa ("você") e um tom humano, caloroso e motivador.
Baseie-se no humor de ${moodValue}/100 (${moodLabel}).
Máximo 2-3 frases. Não mencione IA nem instruções técnicas.
`;

    // tentativa de chamar a OpenAI
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.8,
    });

    const text = response?.choices?.[0]?.message?.content?.trim();
    if (text) {
      return NextResponse.json({ text });
    }

    // se a resposta estiver vazia, fallback
    const fallback = pickLocalMessage(moodValue, moodLabel);
    return NextResponse.json({ text: fallback });
  } catch (err:any) {
    // detecta 429 (quota) ou outros erros e retorna fallback
    console.error("Erro IA (fallback):", err?.message ?? err);

    // tente extrair o status code se disponível
    const message = pickLocalMessage(
      Number((await (async()=>{try{return (await req.json()).moodValue}catch{return 50}})()) || 50),
      "Humor"
    );

    return NextResponse.json({ text: message }, { status: 200 });
  }
}
