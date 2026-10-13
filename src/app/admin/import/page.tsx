'use client';

import Link from 'next/link';
import { Database, Upload, AlertTriangle } from 'lucide-react';

export default function AdminImportPage() {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Importações</h1>
          <p className="mt-1 text-sm text-slate-400">
            Área para operações administrativas (import de missões/SOS, manutenção de tabelas, etc.).
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-2 text-sm hover:bg-slate-900/35"
        >
          Voltar ao dashboard
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-indigo-300" />
            Dica rápida
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Para imports grandes (ex.: 400 missões, 200 ferramentas SOS), o ideal é fazer via Supabase SQL Editor / CSV import.
          </p>
          <ul className="mt-3 list-disc pl-5 text-sm text-slate-400 space-y-1">
            <li>Confirme colunas e tipos (UUID versus texto, numérico versus inteiro).</li>
            <li>Se tiver funções RPC, use <code className="text-slate-200">DROP FUNCTION</code> antes de recriar.</li>
            <li>Prefira índices únicos para evitar duplicidades.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Upload className="h-4 w-4 text-emerald-200" />
            Próximos atalhos
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Se você quiser, eu monto uma tela aqui com “import wizard” (preview do CSV + validação + insert por lotes),
            mas isso exige que o RLS permita inserts pelo cliente admin.
          </p>

          <div className="mt-4 rounded-xl border border-amber-700/40 bg-amber-900/15 p-3 text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div className="text-sm">
                Import via painel funciona melhor quando existe uma <b>service role</b> no backend (API route),
                para não abrir permissão demais no client.
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin/users"
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
            >
              Gestão de usuários
            </Link>
            <Link
              href="/admin/community"
              className="rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-2 text-sm hover:bg-slate-900/35"
            >
              Moderação do mural
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
