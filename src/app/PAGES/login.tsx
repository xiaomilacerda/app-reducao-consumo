'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Mail, Lock, ArrowLeft } from 'lucide-react';
import { storage } from '@/lib/storage';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const syncPremiumFromSupabase = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Tenta buscar o perfil
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', user.id)
        .maybeSingle();

      // Se der erro estranho, só registra no console e segue
      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar perfil:', error);
        return;
      }

      // Se não existir perfil, cria um com is_premium = false
      if (!profile) {
        await supabase
          .from('profiles')
          .upsert({ id: user.id, is_premium: false });
        return;
      }

      // Se existir, sincroniza o status premium com o storage
      const current = storage.getUserData();
      if (current) {
        storage.saveUserData({
          ...current,
          isPremium: !!profile.is_premium,
        });
      }
    } catch (err) {
      console.error('Erro ao sincronizar premium:', err);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      alert('Erro ao fazer login: ' + error.message);
      return;
    }

    // 🔄 depois do login, garante perfil + sincroniza premium
    await syncPremiumFromSupabase();

    // volta para a página anterior (ex: /ai-insights)
    router.back();
  };

  const handleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      alert('Erro ao criar conta: ' + error.message);
      return;
    }

    alert('Conta criada! Verifique seu e-mail.');
    setIsSignUp(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-200 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      {/* Header no mesmo estilo das outras páginas */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Voltar para a página inicial"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </Link>
            <Sparkles className="w-6 h-6 text-purple-500" />
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {isSignUp ? 'Criar conta' : 'Entrar'}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Área de acesso à sua jornada
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <Card className="w-full max-w-md shadow-xl border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <span>{isSignUp ? 'Criar conta' : 'Entrar'}</span>
            </CardTitle>
            <CardDescription>
              {isSignUp
                ? 'Crie uma conta para começar sua jornada'
                : 'Acesse sua conta para continuar'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                <Mail className="w-5 h-5 text-gray-400" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Senha</Label>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                <Lock className="w-5 h-5 text-gray-400" />
                <Input
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <Button
              onClick={isSignUp ? handleSignUp : handleLogin}
              disabled={loading}
              className="w-full"
            >
              {loading
                ? 'Carregando...'
                : isSignUp
                ? 'Criar conta'
                : 'Entrar'}
            </Button>

            <Separator />

            <button
              type="button"
              className="w-full text-sm text-purple-600 dark:text-purple-300 underline"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp
                ? 'Já tem conta? Entre aqui'
                : 'Não tem conta? Crie agora'}
            </button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
