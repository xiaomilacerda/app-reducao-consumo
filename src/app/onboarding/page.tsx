'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { ArrowRight, DollarSign, Calendar, Cigarette, Leaf, Zap, Clock, Bell } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showLongText, setShowLongText] = useState(false);
  
  // Dados do formulário
  const [currency] = useState('BRL');
  const [frequencyAmount, setFrequencyAmount] = useState('');
  const [frequencyPeriod, setFrequencyPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [gramsPerJoint, setGramsPerJoint] = useState('');
  const [thcPotency, setThcPotency] = useState('');
  const [dailyCost, setDailyCost] = useState('');
  const [pricePerGram, setPricePerGram] = useState('');
  const [consumptionMethods, setConsumptionMethods] = useState<string[]>([]);
  const [lastUseDate, setLastUseDate] = useState('');
  const [lastUseTime, setLastUseTime] = useState('');

  const handleMethodToggle = (method: string) => {
    if (consumptionMethods.includes(method)) {
      setConsumptionMethods(consumptionMethods.filter(m => m !== method));
    } else {
      setConsumptionMethods([...consumptionMethods, method]);
    }
  };

  const handleComplete = () => {
    const lastUseDateTime = `${lastUseDate}T${lastUseTime}:00`;
    
    storage.initUserData({
      currency,
      frequencyAmount: parseFloat(frequencyAmount) || 1,
      frequencyPeriod,
      gramsPerJoint: parseFloat(gramsPerJoint) || 0.5,
      thcPotency: parseFloat(thcPotency) || 15,
      dailyCost: parseFloat(dailyCost) || 0,
      pricePerGram: parseFloat(pricePerGram) || 0,
      consumptionMethods,
      lastUseDateTime,
      startDate: lastUseDateTime,
      onboardingCompleted: true,
      isPremium: false,
    });
    
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full p-8 md:p-12">
        
        {/* Passo 1: Boas-vindas */}
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="text-6xl mb-4">🌟</div>
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-4">
              Bem-vindo à sua jornada de transformação!
            </h1>
            
            {!showLongText ? (
              <>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                  Este aplicativo foi criado para apoiar você na redução ou parada do consumo.
                  Vamos começar essa jornada juntos, um dia de cada vez.
                </p>
                <button
                  onClick={() => setShowLongText(true)}
                  className="text-purple-600 dark:text-purple-400 underline mb-6"
                >
                  Ler texto completo
                </button>
              </>
            ) : (
              <div className="text-left text-gray-600 dark:text-gray-400 space-y-4 mb-6 max-h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <p>
                  <strong>Você não está sozinho.</strong> Milhares de pessoas ao redor do mundo estão na mesma jornada que você.
                  Reduzir ou parar o consumo é um processo que exige coragem, determinação e, acima de tudo, autocompaixão.
                </p>
                <p>
                  Este aplicativo foi desenvolvido com base em ciência, experiências reais e muito carinho. Aqui você encontrará:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Monitoramento em tempo real do seu progresso</li>
                  <li>Cálculos precisos de economia e saúde</li>
                  <li>Ferramentas práticas para momentos de fissura</li>
                  <li>Uma comunidade de apoio anônima</li>
                  <li>Conquistas e recompensas motivacionais</li>
                  <li>Recursos para prevenir recaídas</li>
                </ul>
                <p>
                  <strong>Lembre-se:</strong> Recaídas fazem parte do processo. O importante não é ser perfeito, mas sim continuar tentando.
                  Cada dia limpo é uma vitória. Cada recomeço é uma prova de coragem.
                </p>
                <p className="font-semibold text-purple-600 dark:text-purple-400">
                  Vamos começar? Você está prestes a dar o primeiro passo de uma jornada incrível! 💪
                </p>
              </div>
            )}
            
            <button
              onClick={() => setStep(2)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2 mx-auto"
            >
              <span>Começar</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Passo 2: Escolha de moeda */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <DollarSign className="w-8 h-8 text-green-500" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                Moeda
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Confirme a moeda que você usa:
            </p>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-xl border-2 border-green-500">
              <div className="text-center">
                <div className="text-4xl mb-2">🇧🇷</div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  Real Brasileiro (R$)
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Passo 3: Quantidade fumada */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Cigarette className="w-8 h-8 text-orange-500" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                Quanto você fuma?
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Quantas vezes você fuma por:
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantidade
                </label>
                <input
                  type="number"
                  value={frequencyAmount}
                  onChange={(e) => setFrequencyAmount(e.target.value)}
                  placeholder="Ex: 3"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Período
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'day', label: 'Por dia' },
                    { value: 'week', label: 'Por semana' },
                    { value: 'month', label: 'Por mês' },
                  ].map((period) => (
                    <button
                      key={period.value}
                      onClick={() => setFrequencyPeriod(period.value as 'day' | 'week' | 'month')}
                      className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                        frequencyPeriod === period.value
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-purple-300'
                      }`}
                    >
                      <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                        {period.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!frequencyAmount}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Passo 4: Gramas por baseado */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Leaf className="w-8 h-8 text-green-500" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                Gramas por baseado
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Quantas gramas você usa em média por baseado?
            </p>
            
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={gramsPerJoint}
                onChange={(e) => setGramsPerJoint(e.target.value)}
                placeholder="0.5"
                className="w-full px-4 py-4 text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xl text-gray-500">
                gramas
              </span>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                💡 <strong>Dica:</strong> A média é entre 0.3g e 0.7g por baseado.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={!gramsPerJoint}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Passo 5: Potência de THC */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="w-8 h-8 text-yellow-500" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                Potência de THC
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Qual a porcentagem de THC da sua erva? (Se não souber, deixe o padrão)
            </p>
            
            <div className="relative">
              <input
                type="number"
                step="1"
                value={thcPotency}
                onChange={(e) => setThcPotency(e.target.value)}
                placeholder="15"
                className="w-full px-4 py-4 text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xl text-gray-500">
                % THC
              </span>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                💡 <strong>Referência:</strong> Ervas comuns têm entre 10-20% de THC. Strains premium podem ter 20-30%.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setStep(4)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(6)}
                disabled={!thcPotency}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Passo 6: Custo */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <DollarSign className="w-8 h-8 text-green-500" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                Quanto você gasta?
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Informe quanto você gasta por dia OU o preço por grama:
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gasto por dia (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-xl text-gray-500">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={dailyCost}
                    onChange={(e) => setDailyCost(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-12 pr-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
              
              <div className="text-center text-gray-500 font-semibold">OU</div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preço por grama (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-xl text-gray-500">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={pricePerGram}
                    onChange={(e) => setPricePerGram(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-12 pr-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setStep(5)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(7)}
                disabled={!dailyCost && !pricePerGram}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Passo 7: Métodos de consumo */}
        {step === 7 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Cigarette className="w-8 h-8 text-orange-500" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                Métodos de consumo
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Selecione todos os métodos que você usa (pode escolher mais de um):
            </p>
            
            <div className="space-y-3">
              {[
                { value: 'Baseado', icon: '🚬' },
                { value: 'Bong', icon: '💨' },
                { value: 'Vaporizado', icon: '💨' },
                { value: 'Comestível', icon: '🍪' },
                { value: 'Concentrado', icon: '💧' },
                { value: 'Outro', icon: '❓' },
              ].map((method) => (
                <button
                  key={method.value}
                  onClick={() => handleMethodToggle(method.value)}
                  className={`w-full p-4 rounded-xl border-2 transition-all duration-300 flex items-center gap-3 ${
                    consumptionMethods.includes(method.value)
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-purple-300'
                  }`}
                >
                  <span className="text-2xl">{method.icon}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {method.value}
                  </span>
                  {consumptionMethods.includes(method.value) && (
                    <span className="ml-auto text-purple-500">✓</span>
                  )}
                </button>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setStep(6)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(8)}
                disabled={consumptionMethods.length === 0}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Passo 8: Data e hora da última vez */}
        {step === 8 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-8 h-8 text-blue-500" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                Última vez que fumou
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Quando foi a última vez que você fumou?
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data
                </label>
                <input
                  type="date"
                  value={lastUseDate}
                  onChange={(e) => setLastUseDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hora
                </label>
                <input
                  type="time"
                  value={lastUseTime}
                  onChange={(e) => setLastUseTime(e.target.value)}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setStep(7)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(9)}
                disabled={!lastUseDate || !lastUseTime}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Passo 9: Permissão de notificações */}
        {step === 9 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-8 h-8 text-purple-500" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                Notificações
              </h2>
            </div>
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">🔔</div>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Gostaria de receber notificações sobre:
              </p>
              <ul className="text-left space-y-2 text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Conquistas desbloqueadas
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Dicas anti-fissura
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Mensagens motivacionais
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Alertas do despertador de limites
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Lembretes diários
                </li>
              </ul>
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                (Você pode alterar essas configurações depois)
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setStep(8)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300"
              >
                Voltar
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300"
              >
                Finalizar e Começar! 🚀
              </button>
            </div>
          </div>
        )}

        {/* Indicador de progresso */}
        <div className="flex justify-center gap-2 mt-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div
              key={i}
              className={`h-2 w-8 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
