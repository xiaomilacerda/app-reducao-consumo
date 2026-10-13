'use client';

import { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

type GoogleAuthButtonProps = {
  mode: 'signup' | 'login';
};

export default function GoogleAuthButton({ mode }: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleGoogleAuth() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      const requestedNext = new URLSearchParams(window.location.search).get('next');
      if (
        requestedNext &&
        requestedNext.startsWith('/') &&
        !requestedNext.startsWith('//') &&
        !requestedNext.includes('\\')
      ) {
        callbackUrl.searchParams.set('next', requestedNext);
      }

      const { error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl.toString() },
      });

      if (error) throw error;
      // Supabase redirects the browser to Google's sign-in page.
    } catch (error) {
      console.error('Falha ao iniciar autenticação Google:', error);
      setErrorMessage(
        'Não foi possível conectar ao Google. Tente novamente em alguns instantes.'
      );
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <div className="h-px flex-1 bg-gray-700" />
        <span>ou continue com</span>
        <div className="h-px flex-1 bg-gray-700" />
      </div>

      <button
        type="button"
        onClick={handleGoogleAuth}
        disabled={loading}
        aria-label={mode === 'signup' ? 'Criar conta com Google' : 'Entrar com Google'}
        className="w-full flex items-center justify-center gap-3 rounded-xl border border-gray-600 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.22 5.48-4.7 7.18l7.73 6C44.48 38.02 46.98 31.89 46.98 24.55z" />
          <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.51 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {loading
          ? 'Conectando ao Google...'
          : mode === 'signup'
            ? 'Criar conta com Google'
            : 'Entrar com Google'}
      </button>

      {errorMessage && (
        <p role="alert" className="text-xs text-red-300 text-center">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
