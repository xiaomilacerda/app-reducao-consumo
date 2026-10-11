// src/app/api/admin/reports/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // depois podemos ligar isso a uma tabela "community_reports"
  const reports: any[] = [];
  return NextResponse.json(reports);
}
