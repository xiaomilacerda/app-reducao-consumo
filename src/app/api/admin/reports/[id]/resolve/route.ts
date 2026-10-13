// src/app/api/admin/reports/[id]/resolve/route.ts
import { NextResponse } from 'next/server';

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action as 'keep' | 'remove' | undefined;

    if (action !== 'keep' && action !== 'remove') {
      return new NextResponse('Ação inválida', { status: 400 });
    }

    // Depois ligamos isso a uma tabela "community_reports" + "community_posts".
    console.log('Admin resolve report:', id, action);

    // A moderação ainda não possui persistência implementada.
    // Não confirme remoção ou manutenção fictícia de uma denúncia.
    return NextResponse.json({ error: 'Moderação de denúncias ainda não implementada.' }, { status: 501 });
  } catch (error) {
    console.error('POST /api/admin/reports/[id]/resolve error', error);
    return new NextResponse('Erro ao resolver denúncia', { status: 500 });
  }
}
