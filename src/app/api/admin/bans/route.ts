// src/app/api/admin/bans/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // quando criarmos uma tabela de bans, ligamos aqui
  const bans: any[] = [];
  return NextResponse.json(bans);
}
