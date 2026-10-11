'use client';

import { ArrowLeft, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <Shield className="w-6 h-6 text-purple-500" />
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Política de Privacidade
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Como o WeedReset cuida dos seus dados
            </p>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-sm text-gray-800 dark:text-gray-100">
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <p>
            Esta Política de Privacidade explica como o aplicativo <strong>WeedReset</strong>{' '}
            coleta, usa e protege os dados das pessoas que utilizam o app e o site relacionados.
          </p>
          <p>
            Ao usar o WeedReset, você concorda com os termos descritos aqui. Se não concordar,
            recomendamos que não utilize o aplicativo.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">1. Quem somos</h2>
          <p>
            O WeedReset é um aplicativo voltado para apoio à redução e interrupção do uso de
            maconha, oferecendo recursos como acompanhamento de tempo limpo, métricas de consumo,
            conteúdos educativos e ferramentas de autocontrole.
          </p>
          <p>
            Nosso objetivo é apoiar sua jornada, mas o app não substitui acompanhamento médico,
            psicológico ou profissional.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">2. Dados que coletamos</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Dados de cadastro:</strong> e-mail e credenciais de acesso.</li>
            <li>
              <strong>Dados de progresso:</strong> tempo limpo, recaídas, frequência de uso
              anterior, estimativas de consumo e outras informações que você decide registrar.
            </li>
            <li>
              <strong>Dados de conta:</strong> ID de usuário, data de criação, status gratuito
              ou Premium.
            </li>
            <li>
              <strong>Dados técnicos:</strong> informações de dispositivo, endereço IP aproximado,
              versão do app e registros de erro.
            </li>
            <li>
              <strong>Notificações:</strong> se você permitir, podemos enviar lembretes e avisos
              relacionados ao uso do app.
            </li>
          </ul>
          <p>
            Parte dos dados fica armazenada apenas no seu dispositivo, e parte é guardada em
            servidores seguros para que você possa acessar sua conta em diferentes aparelhos.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">3. Como usamos seus dados</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Criar e manter sua conta no WeedReset.</li>
            <li>Calcular tempo limpo, economia e estimativas de saúde.</li>
            <li>Exibir estatísticas da sua jornada e evolução.</li>
            <li>Liberar recursos Premium, quando aplicável.</li>
            <li>Melhorar o funcionamento, segurança e estabilidade do app.</li>
            <li>Cumprir obrigações legais, quando necessário.</li>
          </ul>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">4. Compartilhamento de dados</h2>
          <p>
            Não vendemos seus dados pessoais. Podemos compartilhar informações apenas com
            prestadores de serviço que nos ajudam a operar o app (por exemplo, serviços de
            hospedagem e banco de dados como o Supabase), sempre com obrigações de sigilo e
            proteção de dados.
          </p>
          <p>
            Também podemos compartilhar dados se formos obrigados por lei ou decisão de autoridade
            competente.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">5. Segurança e tempo de guarda</h2>
          <p>
            Adotamos medidas técnicas e organizacionais para tentar manter seus dados protegidos,
            mas nenhum sistema é 100% seguro. Use senhas fortes e não compartilhe sua conta.
          </p>
          <p>
            Manteremos seus dados pelo tempo necessário para o funcionamento do app, para cumprir
            obrigações legais ou até que você solicite a exclusão, quando isso for possível.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">6. Menores de idade</h2>
          <p>
            O WeedReset não é destinado a menores de 18 anos. Se souber que um menor utiliza o
            app e forneceu dados pessoais, entre em contato para que possamos avaliar a remoção
            dessas informações.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">7. Seus direitos e contato</h2>
          <p>
            Dependendo da legislação aplicável, você pode ter direito de acessar, corrigir ou
            solicitar a exclusão de seus dados, bem como retirar consentimentos concedidos.
          </p>
          <p>
            Para dúvidas ou solicitações relacionadas à privacidade, envie um e-mail para:{' '}
            <span className="font-mono text-xs">contato@weedreset.com</span>
          </p>
        </section>
      </main>
    </div>
  );
}
