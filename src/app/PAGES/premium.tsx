'use client';

import { ArrowLeft, Crown, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { storage } from '@/lib/storage';
import { createBrowserClient } from '@supabase/ssr';

export default function PremiumPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleActivatePremium = async () => {
    setLoading(true);

    try {
      // 1) Busca usuário logado no Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // 2) Cria/atualiza o perfil marcando como premium
        await supabase
          .from('profiles')
          .upsert({ id: user.id, is_premium: true });
      }

      // 3) Marca como premium no storage local (app funcionando na hora)
      const data = storage.getUserData();
      if (data) {
        storage.saveUserData({
          ...data,
          isPremium: true,
        });
      }

      // 4) Volta para a IA, agora liberada
      router.push('/ai-insights');
    } catch (err) {
      console.error(err);
      alert('Não foi possível ativar o Premium agora. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </Link>

          <Crown className="w-8 h-8 text-yellow-500" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
            Plano Premium
          </h1>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">

        {/* Card principal */}
        <div className="p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
          <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-3">
            <Crown className="w-7 h-7 text-yellow-500" />
            Desbloqueie todo o potencial da sua jornada
          </h2>

          <p className="text-gray-600 dark:text-gray-400 text-lg mb-6">
            O Premium oferece acesso total a ferramentas exclusivas, insights avançados,
            acompanhamento profundo e recursos inteligentes para ajudar você a vencer o vício.
          </p>

          {/* Lista de benefícios */}
          <div className="space-y-4">
            {[
              'IA de Prevenção de Recaídas',
              'Análises completas do seu progresso',
              'Alertas inteligentes e personalizados',
              'Comunidade exclusiva (em breve)',
              'Receitas e métodos alternativos para relaxar',
              'Modo SOS avançado',
              'Desafios premium e conquistas especiais',
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-gray-700 dark:text-gray-300"
              >
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* Preço */}
          <div className="mt-10 p-6 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg text-center">
            <p className="text-lg font-semibold">Preço promocional de lançamento</p>
            <p className="text-4xl font-bold mt-2">R$ 9,90/mês</p>
            <p className="text-sm opacity-90 mt-1">(Pagando pela Google Play)</p>
          </div>

          {/* Botão de comprar */}
          <button
            onClick={handleActivatePremium}
            className="mt-8 w-full py-4 text-lg font-bold rounded-xl bg-black text-white hover:bg-gray-900 transition disabled:bg-gray-700"
            disabled={loading}
          >
            {loading ? 'Ativando...' : 'Assinar Premium'}
          </button>

          {/* Info do futuro */}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            * Integração real com Google Play Billing será ativada no momento da publicação.
          </p>
        </div>
      </main>
    </div>
  );
}
