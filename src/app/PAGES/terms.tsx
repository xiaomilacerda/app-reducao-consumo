'use client';

import { ArrowLeft, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsPage() {
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
          <FileText className="w-6 h-6 text-purple-500" />
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Termos de Uso
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Regras de utilização do aplicativo WeedReset
            </p>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-sm text-gray-800 dark:text-gray-100">
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <p>
            Estes Termos de Uso regulam o uso do aplicativo <strong>WeedReset</strong> e de
            quaisquer serviços, conteúdos ou funcionalidades a ele relacionados. Ao utilizar o
            aplicativo, você declara que leu, entendeu e concorda com estes termos.
          </p>
          <p>
            Se você não concordar com qualquer parte destes Termos, recomendamos que não use o
            WeedReset.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">1. Finalidade do WeedReset</h2>
          <p>
            O WeedReset é um aplicativo voltado para auxiliar pessoas que desejam reduzir ou
            interromper o uso de maconha, oferecendo ferramentas como:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Contagem de tempo limpo;</li>
            <li>Registro de recaídas;</li>
            <li>Estimativas de economia financeira e impacto na saúde;</li>
            <li>Conteúdos motivacionais e recursos de apoio.</li>
          </ul>
          <p>
            O aplicativo tem caráter informativo e de apoio, não substituindo acompanhamento
            médico, psicológico ou qualquer outro tipo de tratamento profissional.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">2. Uso pessoal e responsável</h2>
          <p>
            O WeedReset é destinado a uso pessoal e individual. Você se compromete a:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Fornecer informações verdadeiras ao criar e usar sua conta;</li>
            <li>Não compartilhar sua conta ou senha com terceiros;</li>
            <li>Não utilizar o aplicativo para fins ilegais ou que violem direitos de terceiros;</li>
            <li>Não tentar fraudar estatísticas, recursos Premium ou mecanismos de segurança.</li>
          </ul>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">3. Conta, acesso e segurança</h2>
          <p>
            Para usar algumas funcionalidades, pode ser necessário criar uma conta com e-mail e
            senha. Você é responsável por:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Manter seus dados de acesso em sigilo;</li>
            <li>Notificar-nos caso suspeite de uso não autorizado da sua conta;</li>
            <li>Garantir que apenas você utilize sua conta.</li>
          </ul>
          <p>
            Podemos, a nosso critério, suspender ou encerrar contas que violem estes termos ou que
            apresentem comportamento suspeito, abuso ou uso indevido das funcionalidades.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">4. Conteúdos e informações do usuário</h2>
          <p>
            As informações que você registra no aplicativo (como datas, recaídas, estimativas de
            consumo e outros dados) são de sua responsabilidade. Você se compromete a não inserir
            conteúdos ilegais, ofensivos, discriminatórios ou que violem direitos de terceiros.
          </p>
          <p>
            Podemos, de forma agregada e anonimizadas, utilizar dados de uso para estatísticas
            internas e melhoria do aplicativo, sem identificar você diretamente.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">5. Recursos gratuitos e Premium</h2>
          <p>
            O WeedReset pode oferecer uma versão gratuita e recursos adicionais na modalidade
            Premium. A disponibilidade, preço, forma de pagamento e benefícios do plano Premium
            podem ser alterados ao longo do tempo.
          </p>
          <p>
            Em caso de dúvidas sobre cobranças realizadas por lojas de aplicativos (como Google
            Play), o contato inicial deve ser feito diretamente pelos canais da própria loja.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">6. Não substituição de tratamento profissional</h2>
          <p>
            O WeedReset não oferece diagnóstico, tratamento médico, psicológico ou psiquiátrico.
            Qualquer informação exibida no app tem caráter de apoio e orientação geral.
          </p>
          <p>
            Em casos de crise, risco à integridade física ou emocional, ou dúvidas sobre
            tratamento, procure imediatamente ajuda profissional, serviços de saúde locais ou
            linhas oficiais de apoio emocional.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">7. Limitação de responsabilidade</h2>
          <p>
            Embora nos esforcemos para manter o WeedReset funcionando de forma estável e segura,
            não garantimos:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Disponibilidade ininterrupta do aplicativo;</li>
            <li>Ausência total de erros, falhas ou interrupções;</li>
            <li>Resultados específicos na sua jornada pessoal de redução ou interrupção do uso.</li>
          </ul>
          <p>
            Você utiliza o aplicativo por sua conta e risco. Qualquer decisão sobre saúde, uso ou
            interrupção de substâncias deve ser tomada com apoio profissional, quando necessário.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">8. Alterações no aplicativo e nos termos</h2>
          <p>
            Podemos atualizar o WeedReset, adicionar ou remover funcionalidades e alterar estes
            Termos de Uso a qualquer momento. Sempre que houver mudanças relevantes, poderemos
            exibir um aviso dentro do app ou atualizar a data de revisão.
          </p>
          <p>
            O uso contínuo do aplicativo após alterações significa que você concorda com os novos
            termos.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="text-base font-semibold">9. Contato</h2>
          <p>
            Em caso de dúvidas sobre estes Termos de Uso ou sobre o funcionamento do WeedReset,
            você pode entrar em contato pelo e-mail:
          </p>
          <p className="font-mono text-xs">contato@weedreset.com</p>
        </section>
      </main>
    </div>
  );
}
