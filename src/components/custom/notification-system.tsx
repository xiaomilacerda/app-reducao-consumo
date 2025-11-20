'use client';

import { useState, useEffect } from 'react';
import { Bell, X, Heart, Trophy, Sparkles, AlertCircle } from 'lucide-react';

interface Notification {
  id: string;
  type: 'achievement' | 'tip' | 'motivational' | 'warning';
  title: string;
  message: string;
  icon: React.ReactNode;
}

const motivationalNotifications = [
  {
    type: 'motivational' as const,
    title: 'Você está indo bem!',
    message: 'Cada momento limpo é uma vitória. Continue assim! 💪',
    icon: <Heart className="w-6 h-6" />,
  },
  {
    type: 'motivational' as const,
    title: 'Lembre-se do seu objetivo',
    message: 'Você começou essa jornada por um motivo. Mantenha o foco! 🎯',
    icon: <Sparkles className="w-6 h-6" />,
  },
  {
    type: 'tip' as const,
    title: 'Dica Anti-Fissura',
    message: 'Quando sentir vontade, beba um copo de água gelada e espere 5 minutos.',
    icon: <AlertCircle className="w-6 h-6" />,
  },
  {
    type: 'tip' as const,
    title: 'Técnica de Respiração',
    message: 'Inspire por 4 segundos, segure por 7, expire por 8. Repita 4 vezes.',
    icon: <AlertCircle className="w-6 h-6" />,
  },
  {
    type: 'motivational' as const,
    title: 'Sua saúde agradece',
    message: 'Cada dia sem fumar melhora sua saúde pulmonar e mental! ❤️',
    icon: <Heart className="w-6 h-6" />,
  },
];

export default function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Mostrar notificação a cada 5 minutos
    const interval = setInterval(() => {
      showRandomNotification();
    }, 5 * 60 * 1000); // 5 minutos

    // Mostrar primeira notificação após 30 segundos
    const timeout = setTimeout(() => {
      showRandomNotification();
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const showRandomNotification = () => {
    const randomNotif = motivationalNotifications[
      Math.floor(Math.random() * motivationalNotifications.length)
    ];
    
    const notification: Notification = {
      id: `notif_${Date.now()}`,
      ...randomNotif,
    };

    setNotifications((prev) => [...prev, notification]);

    // Auto-remover após 10 segundos
    setTimeout(() => {
      removeNotification(notification.id);
    }, 10000);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (!mounted || notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-2xl border-2 border-purple-200 dark:border-purple-800 animate-slide-in-right"
        >
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              notification.type === 'achievement' ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
              notification.type === 'tip' ? 'bg-gradient-to-br from-blue-500 to-cyan-600' :
              notification.type === 'warning' ? 'bg-gradient-to-br from-red-500 to-pink-600' :
              'bg-gradient-to-br from-purple-500 to-pink-600'
            } text-white`}>
              {notification.icon}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1">
                {notification.title}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
