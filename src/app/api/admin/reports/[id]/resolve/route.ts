// src/app/api/admin/reports/[id]/resolve/route.ts
import { NextResponse } from 'next/server';

type Params = {
  params: { id: string };
};

export async function POST(req: Request, { params }: Params) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as 'keep' | 'remove' | undefined;

    if (!action) {
      return new NextResponse('Ação inválida', { status: 400 });
    }

    // Depois ligamos isso a uma tabela "community_reports" + "community_posts".
    console.log('Admin resolve report:', params.id, action);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/admin/reports/[id]/resolve error', error);
    return new NextResponse('Erro ao resolver denúncia', { status: 500 });
  }
}
