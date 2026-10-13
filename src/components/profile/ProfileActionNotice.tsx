'use client';

import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

/**
 * Feedback para ações no Perfil — fica sempre na área visível, inclusive
 * quando a pessoa está rolando dentro do formulário ou escolhe um avatar.
 */
export default function ProfileActionNotice({
  success, error, onDismiss,
}: { success?: string | null; error?: string | null; onDismiss: () => void }) {
  const message = error || success || '';
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, error ? 9000 : 5700);
    return () => window.clearTimeout(timer);
  }, [message, error, onDismiss]);
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center px-4"
      aria-live={error ? 'assertive' : 'polite'}>
      <div role={error ? 'alert' : 'status'}
        className={'pointer-events-auto flex w-full max-w-[350px] items-start gap-3 rounded-2xl border p-4 text-white shadow-2xl ring-1 ring-black/20 backdrop-blur-xl sm:max-w-[410px] ' +
          (error ? 'border-rose-400/60 bg-[#3b2035]/95' : 'border-emerald-400/55 bg-[#183b36]/95')}>
        {error ? <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-200"/> :
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-200"/>}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{error ? 'Não foi possível concluir' : 'Pronto, salvo na nuvem'}</p>
          <p className="mt-1 break-words text-sm leading-relaxed text-white/90">{message}</p>
        </div>
        <button type="button" aria-label="Fechar aviso" onClick={onDismiss}
          className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
          <X className="h-5 w-5"/>
        </button>
      </div>
    </div>
  );
}
