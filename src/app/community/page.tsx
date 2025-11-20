'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { UserData, CommunityPost } from '@/lib/types';
import { Sparkles, Users, Heart, Send, Lock, Crown, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CommunityPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();
    
    if (!data || !data.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }

    setUserData(data);
    loadPosts();
  }, [router]);

  const loadPosts = () => {
    const allPosts = storage.getCommunityPosts();
    setPosts(allPosts);
  };

  const handlePostSubmit = () => {
    if (!newPost.trim() || !userData) return;
    
    if (!userData.isPremium) {
      alert('Apenas usuários Premium podem postar no mural. Atualize sua conta para participar!');
      return;
    }

    storage.addCommunityPost(newPost, userData.isPremium);
    setNewPost('');
    loadPosts();
  };

  if (!mounted || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </Link>
              <Users className="w-8 h-8 text-purple-500" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Comunidade
              </h1>
            </div>
            {userData.isPremium && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-white font-semibold">
                <Crown className="w-5 h-5" />
                <span className="hidden sm:inline">Premium</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Descrição */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              Mural Anônimo
            </h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Compartilhe suas experiências, desabafos e conquistas de forma completamente anônima.
            Todos os posts são anônimos para proteger sua privacidade.
          </p>
          {!userData.isPremium && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-2 border-yellow-400 dark:border-yellow-600">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <span className="font-semibold text-yellow-800 dark:text-yellow-300">
                  Recurso Premium
                </span>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Usuários gratuitos podem visualizar posts, mas apenas usuários Premium podem postar no mural.
                Atualize sua conta para participar da comunidade!
              </p>
            </div>
          )}
        </div>

        {/* Formulário de Post (apenas Premium) */}
        {userData.isPremium && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
              Compartilhe sua experiência
            </h3>
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Escreva aqui... (sua postagem será anônima)"
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none"
              rows={4}
            />
            <button
              onClick={handlePostSubmit}
              disabled={!newPost.trim()}
              className="mt-4 w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              <span>Postar Anonimamente</span>
            </button>
          </div>
        )}

        {/* Lista de Posts */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            Postagens da Comunidade
          </h3>
          
          {posts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Ainda não há postagens. Seja o primeiro a compartilhar!
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        Anônimo
                      </span>
                      {post.isPremiumPost && (
                        <Crown className="w-4 h-4 text-yellow-500" />
                      )}
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        • {new Date(post.timestamp).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {post.content}
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                      <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors">
                        <Heart className="w-5 h-5" />
                        <span>{post.likes}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
