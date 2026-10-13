import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function GET() {
  // Rota diagnóstica: não expor testes de credenciais nem gerar custos em produção.
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "OPENAI_API_KEY não encontrada no ambiente (.env.local).",
          hint: "Verifique se você criou o arquivo .env.local e colocou sua chave lá."
        },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    // Chamada simples para testar
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Só diga: OK" }]
    });

    const text = response.choices?.[0]?.message?.content ?? "Sem resposta";

    return NextResponse.json(
      {
        ok: true,
        message: "Conexão com OpenAI funcionando!",
        result: text
      },
      { status: 200 }
    );

  } catch (err: any) {
    console.error("Erro na API de teste:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Falha ao conectar com a OpenAI.",
        details: err?.message ?? err
      },
      { status: 500 }
    );
  }
}
