'use client';

import { useState, useEffect } from 'react';
import { storage } from '@/lib/storage';
import {
  UserData,
  Recipe,
  AntiRelapseMethod,
  DailyLimit,
  AccessTip,
} from '@/lib/types';
import {
  Heart,
  ArrowLeft,
  Lock,
  Crown,
  Coffee,
  Wind,
  AlertCircle,
  Clock,
  Bell,
} from 'lucide-react';
import Link from 'next/link';

/**
 * =========================
 *  CATÁLOGOS PADRÃO (FALLBACK)
 *  =========================
 */

const DEFAULT_RECIPES: Recipe[] = [
  // ---------- CHÁS ----------
  {
    id: 'calm-chamomile-tea',
    title: 'Chá de Camomila Relaxante',
    category: 'tea',
    ingredients: [
      '1 colher de sopa de flores de camomila secas ou 1 sachê de chá de camomila',
      '200 ml de água quente (não fervendo)',
      'Opcional: 1 colher de chá de mel',
    ],
    instructions:
      'Aqueça a água até quase ferver, desligue o fogo, adicione a camomila e deixe em infusão por 5–10 minutos. Coe, adoce se quiser e beba morno, de preferência 30–60 minutos antes de dormir.',
    benefits:
      'Ajuda a reduzir a tensão, acalmar a mente e preparar o corpo para dormir, podendo aliviar ansiedade leve e melhorar a qualidade do sono com o uso regular.',
    isPremium: false,
  },
  {
    id: 'peppermint-digestion-tea',
    title: 'Chá de Hortelã para Digestão',
    category: 'tea',
    ingredients: [
      '1 punhado de folhas frescas de hortelã ou 1 sachê de chá de hortelã',
      '200 ml de água quente',
      'Opcional: 1 rodela de limão',
    ],
    instructions:
      'Coloque a hortelã na xícara, adicione água quente e deixe em infusão por 5–7 minutos. Coe, adicione limão se quiser e beba após refeições pesadas.',
    benefits:
      'Pode ajudar a aliviar gases, inchaço e desconfortos digestivos leves, dando sensação de alívio no estômago após refeições mais pesadas.',
    isPremium: false,
  },
  {
    id: 'lemon-ginger-detox',
    title: 'Chá de Gengibre com Limão Detox',
    category: 'tea',
    ingredients: [
      '1 pedaço de gengibre (cerca de 2 cm), fatiado',
      '2 rodelas de limão',
      '250 ml de água',
      'Opcional: 1 colher de chá de mel',
    ],
    instructions:
      'Ferva a água com o gengibre por 5 minutos. Desligue o fogo, adicione o limão, deixe descansar 3 minutos e coe. Adoce se quiser e beba ainda morno.',
    benefits:
      'Combinação que pode apoiar a digestão, ajudar na sensação de “peso” após exageros e contribuir para a imunidade, graças ao gengibre e à vitamina C do limão.',
    isPremium: true,
  },
  {
    id: 'evening-relax-tea-mix',
    title: 'Chá da Noite Tranquila (Camomila + Hortelã)',
    category: 'tea',
    ingredients: [
      '1/2 colher de sopa de flores de camomila ou 1/2 sachê',
      'Algumas folhas de hortelã ou 1/2 sachê de hortelã',
      '200 ml de água quente',
    ],
    instructions:
      'Adicione camomila e hortelã na xícara, cubra com água quente e deixe em infusão por 5–8 minutos. Coe e beba de 30 a 60 minutos antes de dormir.',
    benefits:
      'Combina relaxamento da camomila com conforto digestivo da hortelã, ótimo para finais de dia em que a mente está acelerada e o estômago pesado.',
    isPremium: true,
  },
  {
    id: 'passionfruit-sleep-tea',
    title: 'Chá de Maracujá para Sono',
    category: 'tea',
    ingredients: [
      'Polpa de 1 maracujá',
      '200 ml de água quente',
      'Opcional: 1 colher de chá de mel',
    ],
    instructions:
      'Aqueça a água, adicione a polpa de maracujá e deixe em infusão por 5 minutos. Coe, adoce levemente e beba à noite, em ambiente tranquilo.',
    benefits:
      'O maracujá é tradicionalmente usado como aliado em momentos de irritação e dificuldade para relaxar, ajudando a preparar a mente para o descanso.',
    isPremium: false,
  },
  {
    id: 'boldo-liver-tea',
    title: 'Chá Suave de Boldo Pós-Exagero',
    category: 'tea',
    ingredients: [
      'Algumas folhas de boldo frescas ou 1 sachê de chá de boldo',
      '200 ml de água quente',
    ],
    instructions:
      'Coloque o boldo na xícara, adicione água quente e deixe em infusão de 3–5 minutos. Coe e tome em pequenos goles.',
    benefits:
      'Muito usado de forma tradicional após exageros com comida ou substâncias, podendo aliviar sensação de estômago pesado e mal-estar leve.',
    isPremium: true,
  },
  {
    id: 'chamomile-fennel-tea',
    title: 'Chá Digestivo de Camomila com Erva-Doce',
    category: 'tea',
    ingredients: [
      '1/2 colher de sopa de camomila',
      '1/2 colher de sopa de erva-doce',
      '200 ml de água quente',
    ],
    instructions:
      'Misture a camomila e a erva-doce, cubra com água quente e deixe em infusão por 5–8 minutos. Coe e beba após refeições ou antes de dormir.',
    benefits:
      'Ajuda a acalmar o estômago e a mente ao mesmo tempo, sendo uma boa opção para noites em que a fissura vem junto com desconforto digestivo.',
    isPremium: false,
  },
  {
    id: 'mint-lime-iced-tea',
    title: 'Chá Gelado de Hortelã com Limão',
    category: 'tea',
    ingredients: [
      '1 sachê de chá de hortelã',
      '200 ml de água quente',
      'Gelo a gosto',
      'Suco de 1/2 limão',
    ],
    instructions:
      'Faça o chá de hortelã normalmente, espere esfriar, adicione gelo e esprema o limão por cima. Mexa bem.',
    benefits:
      'Refrescante e leve, ótimo para substituir o ritual de “acender um baseado” por um copo bem gelado que dá sensação de limpeza e frescor.',
    isPremium: true,
  },

  // ---------- VITAMINAS ----------
  {
    id: 'banana-oat-anti-craving',
    title: 'Vitamina Anti-Fissura de Banana com Aveia',
    category: 'vitamin',
    ingredients: [
      '1 banana madura',
      '2 colheres de sopa de aveia em flocos',
      '200 ml de leite ou bebida vegetal',
      'Opcional: 1 colher de chá de cacau em pó ou canela',
    ],
    instructions:
      'Bata todos os ingredientes no liquidificador até ficar cremoso. Se quiser, adicione gelo para ficar mais refrescante.',
    benefits:
      'A combinação de fibras da aveia com a banana ajuda na saciedade e fornece energia mais estável, o que pode reduzir a vontade de beliscar e a fissura em momentos de ansiedade.',
    isPremium: false,
  },
  {
    id: 'cocoa-banana-mood',
    title: 'Vitamina de Banana com Cacau para Humor',
    category: 'vitamin',
    ingredients: [
      '1 banana madura',
      '1 colher de sopa de cacau em pó',
      '200 ml de leite ou bebida vegetal',
      '1 colher de chá de mel ou adoçante',
    ],
    instructions:
      'Bata tudo no liquidificador até ficar homogêneo. Sirva imediatamente.',
    benefits:
      'Traz sensação de conforto e prazer sem precisar recorrer à fumaça, ajudando a “enganar” o cérebro quando ele pede recompensa rápida.',
    isPremium: true,
  },
  {
    id: 'papaya-oat-gut-vitamin',
    title: 'Vitamina de Mamão com Aveia para o Intestino',
    category: 'vitamin',
    ingredients: [
      '1 fatia grande de mamão',
      '1 colher de sopa de aveia',
      '150 ml de leite ou iogurte',
      'Opcional: algumas gotas de mel',
    ],
    instructions:
      'Bata tudo no liquidificador até ficar bem cremoso. Se quiser, adicione mais líquido para ficar mais leve.',
    benefits:
      'Ajuda no funcionamento intestinal e na sensação de leveza, o que pode contribuir para um bem-estar geral melhor durante o processo de redução.',
    isPremium: false,
  },
  {
    id: 'strawberry-yogurt-vitamin',
    title: 'Vitamina de Morango com Iogurte',
    category: 'vitamin',
    ingredients: [
      '1 xícara de morangos frescos ou congelados',
      '150 ml de iogurte natural ou grego',
      '50 ml de água ou leite',
    ],
    instructions:
      'Bata tudo no liquidificador até ficar uniforme. Se desejar, adoce levemente.',
    benefits:
      'Combina frescor, proteína e textura cremosa, contribuindo para saciedade e ajudando a transformar a hora da fissura em um momento de cuidado.',
    isPremium: true,
  },

  // ---------- SMOOTHIES ----------
  {
    id: 'green-smoothie-refresh',
    title: 'Smoothie Verde Refrescante',
    category: 'smoothie',
    ingredients: [
      '1 fatia de abacaxi',
      '1 punhado de folhas de espinafre ou couve',
      '1/2 maçã',
      '200 ml de água gelada ou água de coco',
      'Gelo a gosto',
    ],
    instructions:
      'Bata tudo no liquidificador até ficar homogêneo. Se quiser, coe levemente apenas para tirar fibras mais grossas.',
    benefits:
      'Fornece fibras, vitaminas e hidratação, ajudando o corpo a se recuperar de períodos de uso e contribuindo para uma sensação de leveza e bem-estar.',
    isPremium: true,
  },
  {
    id: 'tropical-mango-smoothie',
    title: 'Smoothie Tropical de Manga com Laranja',
    category: 'smoothie',
    ingredients: [
      '1/2 manga madura picada',
      'Suco de 1 laranja',
      '100 ml de água ou água de coco',
      'Gelo a gosto',
    ],
    instructions:
      'Bata todos os ingredientes no liquidificador até obter uma textura cremosa.',
    benefits:
      'Dá energia rápida com sabor marcante, bom para momentos em que a fissura aparece junto com cansaço físico e mental.',
    isPremium: false,
  },
  {
    id: 'berry-sleep-smoothie',
    title: 'Smoothie Noturno de Frutas Vermelhas',
    category: 'smoothie',
    ingredients: [
      '1/2 xícara de frutas vermelhas congeladas',
      '150 ml de leite ou bebida vegetal',
      '1 colher de chá de mel (opcional)',
    ],
    instructions:
      'Bata tudo até ficar bem cremoso. Beba à noite como parte do seu ritual de descanso.',
    benefits:
      'As frutas vermelhas são ricas em antioxidantes e, combinadas com uma bebida mais leve, ajudam a criar um ritual de final de dia saudável.',
    isPremium: true,
  },
  {
    id: 'banana-peanut-boost',
    title: 'Smoothie Energético de Banana com Pasta de Amendoim',
    category: 'smoothie',
    ingredients: [
      '1 banana congelada',
      '1 colher de sopa de pasta de amendoim',
      '200 ml de leite ou bebida vegetal',
      'Gelo a gosto',
    ],
    instructions:
      'Bata tudo no liquidificador até ficar cremoso. Ajuste o líquido conforme a textura desejada.',
    benefits:
      'Mistura saciedade com energia e ajuda a sustentar o corpo em períodos de maior estresse, quando a fissura costuma bater mais forte.',
    isPremium: false,
  },

  // ---------- SUCOS / SHOTS ----------
  {
    id: 'passion-fruit-calm-juice',
    title: 'Suco Calmante de Maracujá',
    category: 'juice',
    ingredients: [
      'Polpa de 1 maracujá',
      '200 ml de água gelada',
      'Gelo a gosto',
      'Opcional: um pouco de adoçante ou mel',
    ],
    instructions:
      'Bata a polpa com a água rapidamente, coe se quiser retirar as sementes, adoce levemente e sirva com gelo.',
    benefits:
      'O maracujá é tradicionalmente usado como aliado em momentos de irritação e tensão, podendo ajudar a dar sensação de calma e relaxamento.',
    isPremium: false,
  },
  {
    id: 'orange-carrot-shot',
    title: 'Shot de Laranja com Cenoura',
    category: 'shot',
    ingredients: [
      'Suco de 1 laranja',
      '1/2 cenoura pequena ralada',
      'Um pedacinho de gengibre (opcional)',
    ],
    instructions:
      'Bata tudo no liquidificador e coe se preferir. Tome em um ou dois goles.',
    benefits:
      'Traz uma explosão rápida de nutrientes e ajuda a marcar simbolicamente o começo de um “dia diferente”, com escolhas mais conscientes.',
    isPremium: true,
  },
  {
    id: 'cucumber-lime-refresh',
    title: 'Água Refrescante de Pepino com Limão',
    category: 'juice',
    ingredients: [
      '4 rodelas de pepino',
      '2 rodelas de limão',
      '300 ml de água gelada',
      'Gelo a gosto',
    ],
    instructions:
      'Coloque tudo em um copo grande ou garrafa, deixe repousar alguns minutos e beba ao longo do dia.',
    benefits:
      'Hidrata e transmite sensação de limpeza interna, ótima para substituir a mão que iria para o cigarro por um gole longo de água saborizada.',
    isPremium: false,
  },
  {
    id: 'apple-cinnamon-warm',
    title: 'Bebida Morna de Maçã com Canela',
    category: 'juice',
    ingredients: [
      '200 ml de suco de maçã (natural ou integral)',
      '1 pedaço de canela em pau',
    ],
    instructions:
      'Aqueça levemente o suco de maçã com a canela, sem deixar ferver. Desligue, retire a canela e sirva em uma caneca.',
    benefits:
      'A bebida quente com canela traz sensação de aconchego e pode substituir o ritual de fumar à noite em dias frios.',
    isPremium: true,
  },
];

const DEFAULT_METHODS: AntiRelapseMethod[] = [
  {
    id: '478-breathing',
    title: 'Respiração 4-7-8 para Baixar a Ansiedade',
    description:
      'Técnica rápida para desacelerar o corpo e a mente em momentos de fissura intensa.',
    category: 'breathing',
    duration: '2–5 minutos',
    steps: [
      'Sente-se ou deite-se em posição confortável, com a coluna ereta.',
      'Inspire pelo nariz contando mentalmente até 4.',
      'Segure o ar nos pulmões contando mentalmente até 7.',
      'Expire lentamente pela boca contando até 8, soltando o ar como se estivesse esvaziando um balão.',
      'Repita o ciclo de 4–7–8 por 4 a 8 vezes, focando apenas na contagem e na sensação da respiração.',
    ],
    isPremium: false,
  },
  {
    id: 'box-breathing',
    title: 'Respiração em Caixa (Box Breathing)',
    description:
      'Ajuda a estabilizar o sistema nervoso quando você sente que está “perdendo o controle”.',
    category: 'breathing',
    duration: '3–5 minutos',
    steps: [
      'Inspire pelo nariz contando até 4.',
      'Segure o ar contando até 4.',
      'Expire pela boca contando até 4.',
      'Fique sem ar contando até 4.',
      'Repita esse quadrado de 4 tempos por pelo menos 2 minutos.',
    ],
    isPremium: true,
  },
  {
    id: 'grounding-54321',
    title: 'Grounding 5-4-3-2-1',
    description:
      'Técnica de aterramento sensorial para quando a mente está cheia de gatilhos e pensamentos sobre fumar.',
    category: 'grounding',
    duration: '3–10 minutos',
    steps: [
      'Olhe ao redor e nomeie 5 coisas que você consegue ver.',
      'Agora identifique 4 coisas que você consegue tocar (a roupa, a cadeira, o chão, etc.).',
      'Depois perceba 3 sons que você consegue ouvir, mesmo que sejam sutis.',
      'Identifique 2 cheiros que você consegue sentir (perfume, comida, ambiente).',
      'Por fim, foque em 1 sabor na boca (pode ser um gole de água ou uma bala).',
    ],
    isPremium: false,
  },
  {
    id: 'cold-water-reset',
    title: 'Reset com Água Fria no Rosto',
    description:
      'Um estímulo físico rápido para “quebrar” o ciclo automático da fissura.',
    category: 'distraction',
    duration: '1–3 minutos',
    steps: [
      'Vá até o banheiro ou cozinha.',
      'Lave o rosto com água fria, sentindo a temperatura na pele.',
      'Respire fundo enquanto a água escorre, focando totalmente nessa sensação.',
      'Repita algumas vezes, sempre trazendo a atenção para o agora.',
    ],
    isPremium: false,
  },
  {
    id: 'mindful-urge-surfing',
    title: 'Surfando a Fissura (Urge Surfing)',
    description:
      'Em vez de lutar com a vontade, você aprende a observar a fissura como uma onda que sobe e desce.',
    category: 'mindfulness',
    duration: '5–10 minutos',
    steps: [
      'Feche os olhos e perceba onde a fissura aparece no corpo (peito apertado, mãos inquietas, etc.).',
      'Imagine que a vontade é uma onda no mar, que começa pequena, cresce e depois naturalmente diminui.',
      'Observe as sensações físicas e pensamentos, sem brigar com eles. Apenas note: “estou com vontade agora, mas isso vai passar”.',
      'Fique curioso: a fissura aumenta, diminui, muda de lugar no corpo?',
      'Continue observando por alguns minutos, até perceber que a intensidade começou a cair.',
    ],
    isPremium: true,
  },
  {
    id: 'walk-10-min',
    title: 'Caminhada de 10 Minutos sem Celular',
    description:
      'Trocar o impulso de fumar por movimento físico e mudança de ambiente.',
    category: 'distraction',
    duration: '10 minutos',
    steps: [
      'Saia de casa (se for seguro) ou caminhe pelo quarteirão.',
      'Deixe o celular em casa ou no bolso, sem mexer.',
      'Enquanto anda, repare nas cores, sons e sensações do corpo se movendo.',
      'Respire fundo algumas vezes durante a caminhada.',
      'Ao voltar, perceba se a fissura mudou de intensidade.',
    ],
    isPremium: false,
  },
  {
    id: 'body-scan',
    title: 'Escaneamento Corporal de 5 Minutos',
    description:
      'Prática de mindfulness focada em relaxar o corpo e perceber onde a tensão está acumulada.',
    category: 'mindfulness',
    duration: '5 minutos',
    steps: [
      'Sente-se ou deite-se de forma confortável.',
      'Feche os olhos e comece percebendo os pés: temperatura, peso, contato com o chão.',
      'Suba lentamente a atenção pelas pernas, quadril, barriga, peito, ombros, pescoço e rosto.',
      'Em cada região, perceba a tensão e, ao expirar, imagine soltando esse peso.',
      'Finalize com 3 respirações profundas, sentindo o corpo mais leve.',
    ],
    isPremium: true,
  },
  {
    id: 'call-someone',
    title: 'Ligar para Alguém de Confiança',
    description:
      'Quebrar a solidão e falar em voz alta o que você está sentindo diminui a força da fissura.',
    category: 'distraction',
    duration: '5–15 minutos',
    steps: [
      'Escolha alguém que você confia e que não vai te julgar.',
      'Envie uma mensagem simples: “Tô numa fissura chata, pode falar comigo uns minutos?”.',
      'Quando falar, descreva o que está sentindo, sem se censurar.',
      'Combine com essa pessoa que ela te lembre dos motivos pelos quais você quer reduzir ou parar.',
    ],
    isPremium: false,
  },
  {
    id: 'journal-5min',
    title: 'Escrita Rápida de 5 Minutos',
    description:
      'Colocar no papel o que está dentro da cabeça ajuda a organizar a confusão e diminuir a vontade.',
    category: 'mindfulness',
    duration: '5 minutos',
    steps: [
      'Pegue papel e caneta ou abra o bloco de notas.',
      'Por 5 minutos, escreva tudo o que vier na mente, sem se preocupar com gramática ou organização.',
      'No fim, leia apenas se quiser. Se não quiser, só rasgue ou feche o app.',
      'Perceba se a intensidade da fissura mudou depois de tirar isso da cabeça.',
    ],
    isPremium: false,
  },
  {
    id: 'stretching-reset',
    title: 'Alongamento Rápido de Descarrego',
    description:
      'Soltar a tensão do corpo fisicamente ajuda a aliviar o “peso” emocional da fissura.',
    category: 'distraction',
    duration: '3–7 minutos',
    steps: [
      'Fique em pé e alongue o pescoço devagar, girando a cabeça em círculos suaves.',
      'Estique os braços para cima como se quisesse alcançar o teto.',
      'Alongue a parte de trás das pernas, flexionando levemente o tronco para frente.',
      'Respire fundo em cada alongamento, soltando o ar devagar.',
    ],
    isPremium: true,
  },
  {
    id: 'five-minute-meditation',
    title: 'Meditação Guiada de 5 Minutos (Silenciosa)',
    description:
      'Versão simples de meditação: sem áudio, só você, respiração e contagem.',
    category: 'mindfulness',
    duration: '5 minutos',
    steps: [
      'Sente-se de forma confortável, com a coluna ereta.',
      'Feche os olhos e foque apenas na respiração entrando e saindo.',
      'Conte até 10 inspirando e expirando, depois volte para 1.',
      'Quando a mente fugir, apenas traga a atenção de volta para a respiração, sem se culpar.',
    ],
    isPremium: true,
  },
  {
    id: 'gratitude-list',
    title: 'Lista de 5 Coisas para Agradecer',
    description:
      'Direcionar a mente para o que está dando certo ajuda a sair do modo “tudo está ruim, então tanto faz fumar”.',
    category: 'mindfulness',
    duration: '3–5 minutos',
    steps: [
      'Pegue papel ou abra o bloco de notas.',
      'Liste 5 coisas pelas quais você é grato hoje, mesmo que sejam simples.',
      'Leia a lista em voz baixa ou só mentalmente.',
      'Respire fundo 3 vezes, segurando essa sensação por alguns segundos.',
    ],
    isPremium: false,
  },
];

const DEFAULT_ACCESS_TIPS: AccessTip[] = [
  {
    id: 'separate-room',
    title: 'Guarde em Outro Cômodo',
    description:
      'Mantenha o material em um cômodo diferente daquele em que você costuma relaxar. Isso cria um “atrito” extra antes de fumar.',
    category: 'environment',
  },
  {
    id: 'hard-to-reach-place',
    title: 'Lugar Difícil de Acessar',
    description:
      'Coloque tudo em uma caixa no alto de um armário ou em um local que dê preguiça de alcançar. Quanto mais passos até pegar, melhor.',
    category: 'storage',
  },
  {
    id: 'no-table-visibility',
    title: 'Nada à Vista em Mesa ou Estante',
    description:
      'Evite deixar dichavador, seda ou potinhos em cima da mesa ou prateleira. Visual é gatilho: se não estiver na frente, a fissura diminui.',
    category: 'environment',
  },
  {
    id: 'routine-change-night',
    title: 'Mude o Ritual da Noite',
    description:
      'Se você sempre fuma vendo série, troque alguns dias por banho quente + chá + leitura leve. Mudar o ritual enfraquece o hábito automático.',
    category: 'routine',
  },
  {
    id: 'friend-agreement',
    title: 'Combinar Limites com Amigos',
    description:
      'Converse com as pessoas com quem você costuma fumar e explique seus limites. Peça ajuda para não oferecerem quando você disser “hoje não”.',
    category: 'social',
  },
  {
    id: 'separate-money',
    title: 'Dinheiro da Maconha em Outra Conta',
    description:
      'Deixe o valor que você normalmente gastaria em uma conta separada para objetivos importantes (curso, viagem, projeto). Isso cria um “travão” na hora de gastar.',
    category: 'routine',
  },
  {
    id: 'delay-rule',
    title: 'Regra dos 15 Minutos',
    description:
      'Quando a vontade bater, se comprometa a esperar 15 minutos antes de decidir. Use esse tempo com respiração, caminhada ou outra técnica do app.',
    category: 'routine',
  },
  {
    id: 'no-use-in-bedroom',
    title: 'Quarto Livre de Fumaça',
    description:
      'Defina que o quarto será um espaço “sem fumar”. Isso ajuda o cérebro a associar o ambiente ao descanso, não à fissura.',
    category: 'environment',
  },
  {
    id: 'social-distance-users',
    title: 'Evite Rolês com Muito Gatilho no Início',
    description:
      'No começo, diminua um pouco a exposição a festas ou encontros em que todo mundo fuma o tempo todo. Não é pra se isolar, é só se proteger.',
    category: 'social',
  },
  {
    id: 'kit-fissura',
    title: 'Crie um “Kit Fissura”',
    description:
      'Prepare um kit com chá, bala, elástico de cabelo, squeeze de água, algo para apertar nas mãos e uma lista de técnicas. Use sempre que a fissura vier.',
    category: 'storage',
  },
  {
    id: 'disable-notifications',
    title: 'Silencie Notificações que Viram Gatilho',
    description:
      'Se alguns grupos ou apps te lembram o tempo todo de fumar, silencie temporariamente. Menos estímulo, menos pressão.',
    category: 'environment',
  },
  {
    id: 'change-spot',
    title: 'Troque o Lugar do “Rolezinho”',
    description:
      'Se sempre rola no mesmo canto da casa ou na mesma praça, teste mudar o lugar para quebrar a associação automática.',
    category: 'environment',
  },
  {
    id: 'no-stock',
    title: 'Evite Ficar com Estoque Grande em Casa',
    description:
      'Quanto mais fácil e disponível, mais difícil de dizer não. Tente comprar quantidades menores ou aumentar o intervalo entre compras.',
    category: 'storage',
  },
  {
    id: 'family-agreement',
    title: 'Acordo com Quem Mora com Você',
    description:
      'Combine com quem divide a casa para não fumar perto de você ou deixar coisas espalhadas. Pequenos acordos evitam gatilhos diários.',
    category: 'social',
  },
  {
    id: 'trigger-list',
    title: 'Lista de Gatilhos Visível',
    description:
      'Anote em um papel os principais gatilhos (horários, pessoas, lugares) e deixe em um lugar visível. Ver essa lista te lembra de se proteger.',
    category: 'routine',
  },
];

/**
 * =========================
 *  COMPONENTE PRINCIPAL
 * =========================
 */

export default function CantStopPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'recipes' | 'methods' | 'alarm' | 'tips'
  >('recipes');

  // Dados
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [methods, setMethods] = useState<AntiRelapseMethod[]>([]);
  const [accessTips, setAccessTips] = useState<AccessTip[]>([]);
  const [dailyLimit, setDailyLimit] = useState<DailyLimit | null>(null);
  const [newLimit, setNewLimit] = useState('');

  useEffect(() => {
    setMounted(true);
    const data = storage.getUserData();

    if (!data) {
      const nowIso = new Date().toISOString();
      const defaultData: UserData = {
        ...storage.getUserData(),
        startDate: nowIso,
        lastRelapseDate: null,
        totalRelapses: 0,
        currency: 'BRL',
        onboardingCompleted: true,
        isPremium: false,
        dailyCost: 20,
        gramsPerJoint: 0.5,
        thcPotency: 5,
        pricePerGram: 10,
        consumptionMethods: [],
        frequencyAmount: 4,
        frequencyPeriod: 'day',
        lastUseDateTime: null,
        relapseHistory: [],
        xp: 0,
        level: 1,
        completedMissions: [],
        unlockedRewards: [],
        themeMode: 'default',
        detoxCycleActive: false,
        detoxCycleStartDate: null,
        friends: [],
      } as UserData;

      storage.saveUserData(defaultData);
      setUserData(defaultData);
      loadData();
      return;
    }

    const safeData: UserData = {
      ...data,
      startDate: data.startDate || new Date().toISOString(),
      lastRelapseDate: data.lastRelapseDate ?? null,
      dailyCost:
        typeof data.dailyCost === 'number' && !Number.isNaN(data.dailyCost)
          ? data.dailyCost
          : 20,
      gramsPerJoint:
        typeof data.gramsPerJoint === 'number' &&
        !Number.isNaN(data.gramsPerJoint)
          ? data.gramsPerJoint
          : 0.5,
      pricePerGram:
        typeof data.pricePerGram === 'number' &&
        !Number.isNaN(data.pricePerGram)
          ? data.pricePerGram
          : 10,
      frequencyAmount:
        typeof data.frequencyAmount === 'number' &&
        !Number.isNaN(data.frequencyAmount)
          ? data.frequencyAmount
          : 4,
      frequencyPeriod: data.frequencyPeriod || 'day',
      thcPotency:
        typeof data.thcPotency === 'number' && !Number.isNaN(data.thcPotency)
          ? data.thcPotency
          : 5,
      themeMode: data.themeMode || 'default',
    };

    setUserData(safeData);
    loadData();
  }, []);

  const loadData = () => {
    const storedRecipes = storage.getRecipes() || [];
    const storedMethods = storage.getMethods() || [];
    const storedTips = storage.getAccessTips() || [];
    const storedLimit = storage.getDailyLimit();

    // 🔹 Merge de receitas: as do usuário + catálogo padrão, sem repetir id
    const recipesById = new Map<string, Recipe>();
    [...storedRecipes, ...DEFAULT_RECIPES].forEach((r) => {
      if (!recipesById.has(r.id)) {
        recipesById.set(r.id, r);
      }
    });
    const mergedRecipes = Array.from(recipesById.values());

    // 🔹 Merge de métodos
    const methodsById = new Map<string, AntiRelapseMethod>();
    [...storedMethods, ...DEFAULT_METHODS].forEach((m) => {
      if (!methodsById.has(m.id)) {
        methodsById.set(m.id, m);
      }
    });
    const mergedMethods = Array.from(methodsById.values());

    // 🔹 Merge de dicas
    const tipsById = new Map<string, AccessTip>();
    [...storedTips, ...DEFAULT_ACCESS_TIPS].forEach((t) => {
      if (!tipsById.has(t.id)) {
        tipsById.set(t.id, t);
      }
    });
    const mergedTips = Array.from(tipsById.values());

    setRecipes(mergedRecipes);
    setMethods(mergedMethods);
    setAccessTips(mergedTips);
    setDailyLimit(storedLimit);
  };

  const handleSetLimit = () => {
    const value = Number(newLimit);
    if (!Number.isFinite(value) || value <= 0) return;
    const limit = storage.setDailyLimit(Math.floor(value));
    setDailyLimit(limit);
    setNewLimit('');
  };

  const handleIncrementLimit = () => {
    const updatedLimit = storage.incrementDailyLimit();
    setDailyLimit(updatedLimit);
  };

  if (!mounted || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  const isPremium = userData.isPremium;
  const isFocusMode = userData.themeMode === 'focus';

  const limitProgress =
    dailyLimit && dailyLimit.maxUses > 0
      ? Math.min(
          100,
          Math.max(0, (dailyLimit.currentUses / dailyLimit.maxUses) * 100)
        )
      : 0;

  const totalRecipes = recipes.length;
  const premiumRecipes = recipes.filter((r) => r.isPremium).length;
  const freeRecipes = totalRecipes - premiumRecipes;

  const totalMethods = methods.length;
  const premiumMethods = methods.filter((m) => m.isPremium).length;
  const freeMethods = totalMethods - premiumMethods;

  const totalTips = accessTips.length;

  return (
    <div
      className={`min-h-screen ${
        isFocusMode
          ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900'
          : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'
      }`}
    >
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-xl shadow-lg sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-white/80" />
              </Link>
              <Heart className="w-8 h-8 text-red-500" />
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                  Não Consigo Parar
                </h1>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Tela pensada para os momentos mais difíceis da jornada.
                </span>
              </div>
            </div>
            {isPremium && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-white font-semibold">
                <Crown className="w-5 h-5" />
                <span className="hidden sm:inline">Premium</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Descrição / acolhimento */}
        <div className="bg-gradient-to-r from-red-500 to-pink-600 rounded-2xl p-6 shadow-xl text-white">
          <h2 className="text-2xl font-bold mb-3">
            Recursos para Momentos Difíceis
          </h2>
          <p className="text-lg opacity-90 mb-3">
            Essa parte do Weed Reset foi criada para quando a vontade aperta, a
            fissura vem forte ou você sente que está prestes a perder o
            controle. Aqui você encontra ferramentas práticas para atravessar
            esse momento sem julgamento.
          </p>
          <p className="text-sm opacity-80">
            Use o que fizer mais sentido pra você agora: uma receita rápida, um
            exercício de respiração, um limite para hoje ou uma mudança no
            ambiente.
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              onClick={() => setActiveTab('recipes')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'recipes'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Coffee className="w-5 h-5" />
              <span className="hidden sm:inline">Receitas</span>
            </button>
            <button
              onClick={() => setActiveTab('methods')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'methods'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Wind className="w-5 h-5" />
              <span className="hidden sm:inline">Métodos</span>
            </button>
            <button
              onClick={() => setActiveTab('alarm')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'alarm'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span className="hidden sm:inline">Despertador</span>
            </button>
            <button
              onClick={() => setActiveTab('tips')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'tips'
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <AlertCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Dicas</span>
            </button>
          </div>
        </div>

        {/* TAB: RECEITAS ALTERNATIVAS */}
        {activeTab === 'recipes' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-1">
                    Receitas Alternativas
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    Substitua o ato de fumar por algo saudável e gostoso. Use
                    essas receitas como pequenos rituais para quebrar o
                    automático.
                  </p>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 sm:text-right">
                  <p>
                    Total:{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {totalRecipes}
                    </span>{' '}
                    receitas
                  </p>
                  <p>
                    Gratuitas:{' '}
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {freeRecipes}
                    </span>{' '}
                    · Premium:{' '}
                    <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                      {premiumRecipes}
                    </span>
                  </p>
                </div>
              </div>

              {recipes.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  Nenhuma receita cadastrada ainda. Assim que você tiver
                  receitas salvas no app, elas vão aparecer aqui.
                </p>
              )}
            </div>

            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl ${
                  recipe.isPremium && !isPremium ? 'opacity-90' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">
                      {recipe.title}
                    </h4>
                    <span className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-semibold">
                      {recipe.category === 'juice' && '🥤 Suco'}
                      {recipe.category === 'smoothie' && '🍹 Smoothie'}
                      {recipe.category === 'vitamin' && '🥛 Vitamina'}
                      {recipe.category === 'tea' && '☕ Chá'}
                      {recipe.category === 'shot' && '⚡ Shot funcional'}
                    </span>
                  </div>
                  {recipe.isPremium && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-semibold">
                      <Crown className="w-4 h-4" />
                      <span>Premium</span>
                    </div>
                  )}
                </div>

                {!recipe.isPremium || isPremium ? (
                  <>
                    <div className="mb-4">
                      <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Ingredientes:
                      </h5>
                      <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                        {recipe.ingredients.map((ingredient, idx) => (
                          <li key={idx}>{ingredient}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mb-4">
                      <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Modo de preparo:
                      </h5>
                      <p className="text-gray-600 dark:text-gray-400">
                        {recipe.instructions}
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <h5 className="font-semibold text-blue-700 dark:text-blue-400 mb-1">
                        Benefícios:
                      </h5>
                      <p className="text-blue-600 dark:text-blue-300 text-sm">
                        {recipe.benefits}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <h5 className="font-semibold text-blue-700 dark:text-blue-400 mb-1">
                        Benefícios desta receita:
                      </h5>
                      <p className="text-blue-600 dark:text-blue-300 text-sm">
                        {recipe.benefits}
                      </p>
                    </div>
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl flex items-center gap-3">
                      <Lock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      <p className="text-yellow-700 dark:text-yellow-400 text-sm">
                        Para ver ingredientes e modo de preparo completos desta
                        receita, atualize para o plano Premium.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB: MÉTODOS ANTI-RECAÍDA */}
        {activeTab === 'methods' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-1">
                    Métodos Anti-Recaída
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    Técnicas práticas para lidar com a fissura, ansiedade e
                    gatilhos imediatos. Experimente e descubra quais combinam
                    mais com você.
                  </p>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 sm:text-right">
                  <p>
                    Total:{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {totalMethods}
                    </span>{' '}
                    métodos
                  </p>
                  <p>
                    Gratuitos:{' '}
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {freeMethods}
                    </span>{' '}
                    · Premium:{' '}
                    <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                      {premiumMethods}
                    </span>
                  </p>
                </div>
              </div>

              {methods.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  Nenhum método cadastrado ainda. Assim que você tiver métodos
                  configurados, eles aparecerão aqui.
                </p>
              )}
            </div>

            {methods.map((method) => (
              <div
                key={method.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl ${
                  method.isPremium && !isPremium ? 'opacity-90' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">
                      {method.title}
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                      {method.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-semibold">
                        {method.category === 'breathing' &&
                          '🌬️ Respiração guiada'}
                        {method.category === 'grounding' &&
                          '🧘 Grounding / Presença'}
                        {method.category === 'distraction' &&
                          '🎯 Distração saudável'}
                        {method.category === 'mindfulness' &&
                          '🧠 Mindfulness'}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ⏱️ {method.duration}
                      </span>
                    </div>
                  </div>
                  {method.isPremium && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-semibold">
                      <Crown className="w-4 h-4" />
                      <span>Premium</span>
                    </div>
                  )}
                </div>

                {!method.isPremium || isPremium ? (
                  <div className="mt-4">
                    <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Passos:
                    </h5>
                    <ol className="space-y-2">
                      {method.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400 pt-0.5">
                            {step}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl flex items-start gap-3">
                    <Lock className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-1" />
                    <div>
                      <p className="text-yellow-700 dark:text-yellow-400 text-sm mb-2">
                        Você já consegue entender a ideia deste método pela
                        descrição acima.
                      </p>
                      <p className="text-yellow-700 dark:text-yellow-400 text-sm">
                        Para ver o passo a passo detalhado e praticar com
                        segurança, atualize para o plano Premium.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB: DESPERTADOR DE LIMITES */}
        {activeTab === 'alarm' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Despertador de Limites
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Defina um limite diário e registre cada uso. Não é para
                incentivar o consumo, e sim para ajudar você a ter consciência e
                construir uma redução gradual.
              </p>
              {!isPremium && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-2 border-yellow-400 dark:border-yellow-600">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <span className="font-semibold text-yellow-800 dark:text-yellow-300">
                      Recurso Premium
                    </span>
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    O despertador avançado está disponível apenas para usuários
                    Premium.
                  </p>
                </div>
              )}
            </div>

            {isPremium && (
              <>
                {!dailyLimit && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
                      Definir Limite de Hoje
                    </h4>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        min={1}
                        value={newLimit}
                        onChange={(e) => setNewLimit(e.target.value)}
                        placeholder="Ex: 3"
                        className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      />
                      <button
                        onClick={handleSetLimit}
                        disabled={
                          !newLimit ||
                          !Number.isFinite(Number(newLimit)) ||
                          Number(newLimit) <= 0
                        }
                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Definir
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Quantas vezes você quer fumar hoje, no máximo?
                    </p>
                  </div>
                )}

                {dailyLimit && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                        Limite de Hoje
                      </h4>
                      {dailyLimit.completed ? (
                        <span className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full font-semibold">
                          Limite Atingido
                        </span>
                      ) : (
                        <span className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-semibold">
                          Dentro do Limite
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-600 dark:text-gray-400">
                          Progresso:
                        </span>
                        <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                          {dailyLimit.currentUses} / {dailyLimit.maxUses}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            dailyLimit.completed
                              ? 'bg-gradient-to-r from-red-500 to-pink-600'
                              : 'bg-gradient-to-r from-green-500 to-emerald-600'
                          }`}
                          style={{ width: `${limitProgress}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleIncrementLimit}
                      disabled={dailyLimit.completed}
                      className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Registrar Uso
                    </button>

                    {dailyLimit.currentUses >=
                      dailyLimit.maxUses - 1 &&
                      !dailyLimit.completed && (
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border-2 border-orange-400 dark:border-orange-600">
                          <div className="flex items-center gap-2">
                            <Bell className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            <span className="font-semibold text-orange-800 dark:text-orange-300">
                              Atenção! Você está próximo do seu limite de hoje.
                            </span>
                          </div>
                        </div>
                      )}
                  </div>
                )}

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
                  <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">
                    Como usar o despertador a seu favor
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li>
                      <strong>Plano suave:</strong> se você fuma 5 por dia,
                      comece limitando para 4 por alguns dias, depois 3, e assim
                      por diante.
                    </li>
                    <li>
                      <strong>Plano moderado:</strong> escolha 2 dias da semana
                      com limite bem menor e use mais métodos e receitas do app
                      nesses dias.
                    </li>
                    <li>
                      <strong>Plano agressivo:</strong> use o limite apenas
                      para registrar “escapes” raros, tratando cada uso como
                      exceção e não como rotina.
                    </li>
                    <li>
                      Sempre que registrar um uso, tente combinar com uma ação
                      de cuidado (chá, caminhada, respiração) para treinar o
                      cérebro a ligar o hábito ao autocuidado, não só ao
                      consumo.
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB: DICAS DE DIFICULTAR ACESSO */}
        {activeTab === 'tips' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-1">
                    Dicas para Dificultar o Acesso
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    A ideia aqui é deixar o ato de fumar menos automático e menos
                    conveniente, mexendo no ambiente, na rotina e em como você
                    guarda as coisas.
                  </p>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 sm:text-right">
                  <p>
                    Total:{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {totalTips}
                    </span>{' '}
                    dicas
                  </p>
                </div>
              </div>

              {accessTips.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  Nenhuma dica cadastrada ainda. Assim que você tiver dicas
                  salvas, elas aparecem aqui.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accessTips.map((tip) => (
                <div
                  key={tip.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
                        {tip.title}
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400 mb-3">
                        {tip.description}
                      </p>
                      <span className="inline-block px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-sm font-semibold">
                        {tip.category === 'environment' && '🏠 Ambiente'}
                        {tip.category === 'storage' && '📦 Armazenamento'}
                        {tip.category === 'routine' && '🔄 Rotina'}
                        {tip.category === 'social' && '👥 Social'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
